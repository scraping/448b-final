package vis.data.model.query;

import java.sql.SQLException;
import java.util.Arrays;

import org.apache.commons.lang3.tuple.Pair;

import vis.data.model.RawLemma;
import vis.data.model.meta.DocForLemmaAccessor;
import vis.data.model.meta.LemmaAccessor;
import vis.data.util.CountAggregator;
import vis.data.util.SetAggregator;

public class LemmaTerm extends Term {
	public static class Parameters extends RawLemma {
		public boolean filterOnly_;

		@Override
		public int hashCode() {
			int hashCode = new Boolean(filterOnly_).hashCode();
			hashCode ^= id_;
			hashCode ^= Parameters.class.hashCode();
			if(lemma_ != null)
				hashCode ^= lemma_.hashCode();
			if(pos_ != null)
				hashCode ^= pos_.hashCode();
			return hashCode;
		}
		
		@Override
		public boolean equals(Object obj) {
			if(!Parameters.class.isInstance(obj))
				return false;
			Parameters p = (Parameters)obj;
			if(filterOnly_ != p.filterOnly_) {
				return false;
			}
			if(id_ != p.id_) {
				return false;
			}
			if(lemma_ != null ^ p.lemma_ != null) {
				return false;
			}
			if(lemma_ != null && !lemma_.equals(p.lemma_)) {
				return false;
			}
			if(pos_ != null ^ p.pos_ != null) {
				return false;
			}
			if(pos_ != null && !pos_.equals(p.pos_)) {
				return false;
			}
			return true;
		}	
	}
	
	public final boolean filterOnly_;
	public final Parameters parameters_;
	public final int docs_[];
	public final int count_[];
	public LemmaTerm(Parameters p) throws SQLException {
		int lemmas[];
		DocForLemmaAccessor dlh = new DocForLemmaAccessor();
		parameters_ = p;
		filterOnly_ = p.filterOnly_;
		if(p.id_ != 0) {
			lemmas = new int[1];
			lemmas[0] = p.id_;
		} else if (p.lemma_ != null || p.pos_ != null){
			LemmaAccessor lr = new LemmaAccessor();
			RawLemma rls[] = null;
			if(p.lemma_ != null && p.pos_ != null) {
				RawLemma rl = lr.lookupLemma(p.lemma_, p.pos_);
				if(rl == null) {
					rls = new RawLemma[0];
				} else {
					rls = new RawLemma[1];
					rls[0] = rl; 
				}
			} else if(p.lemma_ != null) {
				rls = lr.lookupLemmaByWord(p.lemma_);
			} else if(p.pos_ != null) {
				rls = lr.lookupLemmaByPos(p.pos_);
			} else {
				throw new RuntimeException("incomplete lemma term");
			}
			
			int[] ids = new int[rls.length];
			for(int i = 0; i < ids.length; ++i) {
				ids[i] = rls[i].id_;
			}
			Arrays.sort(ids);
			lemmas = ids;
		} else {
			throw new RuntimeException("failed setting up LemmaTerm");
		}

		if(lemmas.length == 0) {
			docs_ = new int[0];
			count_ = new int[0];
		} else {
			DocForLemmaAccessor.Counts initial = dlh.getDocCounts(lemmas[0]);
			for(int i = 1; i < lemmas.length; ++i) {
				DocForLemmaAccessor.Counts partial = dlh.getDocCounts(lemmas[1]);
				Pair<int[], int[]> res = CountAggregator.or(initial.docId_, initial.count_, partial.docId_, partial.count_);
				initial.docId_ = res.getKey();
				initial.count_ = res.getValue();
			}
			docs_ = initial.docId_;
			count_ = initial.count_;
		}
	}

	public Object parameters() {
		return parameters_;
	}	

	@Override
	public boolean isFilter() {
		return filterOnly_;
	}

	@Override
	public int size() {
		return docs_.length;
	}

	@Override
	public int[] filter(int[] items) throws SQLException {
		if(docs_.length == 0)
			return new int[0];
		if(items == null)
			return docs_;
		else
			return SetAggregator.and(docs_, items);
	}

	@Override
	public Pair<int[], int[]> filter(int[] in_docs, int[] in_counts)
			throws SQLException {
		if(docs_.length == 0)
			return Pair.of(new int[0], new int[0]);
		if(in_docs == null)
			return Pair.of(docs_, new int[docs_.length]);
		else
			return CountAggregator.filter(in_docs, in_counts, docs_);
	}

	@Override
	public Pair<int[], int[]> aggregate(int[] in_docs, int[] in_counts)
			throws SQLException {
		if(docs_.length == 0)
			return Pair.of(new int[0], new int[0]);
		if(in_docs == null)
			return Pair.of(docs_, count_);
		else
			return CountAggregator.and(docs_, count_, in_docs, in_counts);
	}
}
