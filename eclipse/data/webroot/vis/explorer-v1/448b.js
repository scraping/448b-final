// http://phrogz.net/js/classes/OOPinJS2.html
Function.prototype.inheritsFrom = function( parentClassOrObject ){ 
	if ( parentClassOrObject.constructor == Function ) 
	{ 
		//Normal Inheritance 
		this.prototype = new parentClassOrObject;
		this.prototype.constructor = this;
		this.prototype.parent = parentClassOrObject.prototype;
	} 
	else 
	{ 
		//Pure Virtual Inheritance 
		this.prototype = parentClassOrObject;
		this.prototype.constructor = this;
		this.prototype.parent = parentClassOrObject;
	} 
	return this;
} 

function AbstractFilter() {
	this.filterType = "abstract";
	this.container = undefined;
}
AbstractFilter.prototype.remove = function() {
	if(this.container) {
		ko.utils.arrayRemoveItem(this.container, this);
		this.mutateParent();
		this.container = undefined;
	}
}
AbstractFilter.prototype.mutateParent = function() {
	if(this.container) {
		this.container.valueHasMutated();
	}
}
AbstractFilter.prototype.toPlainObject = function() {
	return { filterType: this.filterType }
}



SearchFilter.inheritsFrom(AbstractFilter);
function SearchFilter() {
	this.parent.constructor.call(this);
	this.filterType = "text";
	this.disjunction = new ko.observableArray([]);
}
SearchFilter.prototype.addLiteral = function(literal) {
	this.disjunction.push(new ko.observable(literal));
	this.disjunction.valueHasMutated();
	this.mutateParent();
}
SearchFilter.prototype.removeLiteral = function(literal) {
	ko.utils.arrayRemoveItem(this.disjunction, literal);
	this.mutateParent();
}
SearchFilter.prototype.toPlainObject = function() {
	var retval = this.parent.toPlainObject.call(this);
	var d = ko.utils.unwrapObservable(this.disjunction());
	retval.disjunction = [];
	for(var i = 0; i < d.length; i++) {
		retval.disjunction[i] = ko.utils.unwrapObservable(d[i]);
	}
	return retval;
}


 
var viewModel = {
	filters: ko.observableArray([]),
	buckets: ko.observableArray([]),
	startYear: ko.observable(2000),
	endYear: ko.observable(2010),
	horizontalAxis: ko.observable("date"),
	dateGranularity: ko.observable("year"),
	dateGranularityOptions: ["year", "month" /*, "fixed #"*/],
	dateGranularityFixed: ko.observable(100),
	
	addFilter: function (filter) {
		filter.container = viewModel.filters;
        viewModel.filters.push(filter);
        viewModel.filters.valueHasMutated();
    },
    
    addBucket: function (filter) {
		filter.container = viewModel.buckets;
        viewModel.buckets.push(filter);
        viewModel.buckets.valueHasMutated();
    },
    
    toPlainObject: function () {
    	var retval = {
    		filters: [],
    		buckets: [],
    		startYear: this.startYear(),
    		endYear: this.endYear(),
    		horizontalAxis: this.horizontalAxis()};
    	for(i = 0; i < this.filters().length; i++) {
			retval.filters.push(this.filters()[i].toPlainObject());
		}
		for(i = 0; i < this.buckets().length; i++) {
			retval.buckets.push(this.buckets()[i].toPlainObject());
		}
		if(retval.horizontalAxis == "date") {
			retval.dateGranularity = this.dateGranularity();
			if(retval.dateGranularity == "fixed #")
				retval.dateGranularityFixed = this.dateGranularityFixed();
		}
		return retval;
    },
	
	save: function () {
        viewModel.lastSavedJson(ko.utils.stringifyJson(queryForModelState(this.toPlainObject()), null, 2));
    },
    lastSavedJson: new ko.observable(""),
    
    // State below this does not reflect query stuff and doesn't need to be saved to JSON
    
    debug: true,
	suggestions: ko.observableArray([]), 
	graphModeOptions: ["bars","lines","steps"],
	graphMode: ko.observable("bars"),
	graphStack: ko.observable(true),
	graphFill: ko.observable(true),
	graphData: ko.observable([]),
}

viewModel.graphOptions = ko.dependentObservable(function() {
    var retval = {
		series: {
			stack: this.graphStack() ? 1 : null,
			lines: { show: (this.graphMode() == "lines" || this.graphMode() == "steps"), fill: this.graphFill(), steps: this.graphMode() == "steps" },
			bars: { show: this.graphMode() == "bars",
					barWidth: 0.8 }
		},
		xaxis: {},
		yaxis: {min: 0 },
    };
    
    if(this.horizontalAxis() == "page") {
    	retval.xaxis.mode = null;
		retval.xaxis.min = 0;
		retval.xaxis.max = 32;
    }
    else if(this.horizontalAxis() == "date") {
    	retval.xaxis.mode = "time";
		retval.xaxis.min = new Date(this.startYear(), 0, 1).getTime();
		if(this.graphMode() == "lines" || this.graphMode() == "steps") {
			if(this.dateGranularity() == "year") {
				retval.xaxis.max = new Date(this.endYear(), 0, 1).getTime();
			} else if(this.dateGranularity() == "month") {
				retval.xaxis.max = new Date(this.endYear(), 11, 0).getTime();
			}
		}
		else {
			retval.xaxis.max = new Date(this.endYear(), 11, 30).getTime();
			if(this.dateGranularity() == "year") {
				retval.series.bars.barWidth = 0.8*365*86400000;	
			} else if(this.dateGranularity() == "month") {
				retval.series.bars.barWidth = 0.8*28*86400000;
			}
		}
		if(this.dateGranularity() == "year") {
			retval.xaxis.minTickWidth = [1, "year"];

		} else if(this.dateGranularity() == "month") {
			retval.xaxis.minTickWidth = [1, "month"];
		}
    }
    return retval;
}, viewModel);


function updatePlot() {
	$.plot($("#graph_container"), viewModel.graphData(), viewModel.graphOptions());
}

viewModel.graphOptions.subscribe(updatePlot);
viewModel.graphData.subscribe(updatePlot);

function array_range(x,y,step) {
	var retval = [];
	if(!step) step = 1;
	for(var i = x; i <= y; i+=step)
		retval.push(i);
	return retval;
}

function fakeData(state) {
	return state.buckets.map(function(x) {
		if (state.horizontalAxis == "page")
			return array_range(1, 30).map(function(a) {
				return [a, parseInt(Math.random() * 30)];
			});
		else if(state.dateGranularity == "year")
			return array_range(state.startYear, state.endYear).map(function(a) {
				return [new Date(a,0,0).getTime(), parseInt(Math.random() * 30)];
			});
		else if (state.dateGranularity == "month")
			return array_range(state.startYear, state.endYear).map(function(a) {
				return array_range(0,11).map(function(b) {
					return [new Date(a,b,0).getTime(),parseInt(Math.random() * 30)]
				});
			}).reduce(function(m,n) {
				return m.concat(n);
			});
		else if (state.dateGranularity == "fixed #")
			return array_range(1, state.dateGranularityFixed).map(function(a) {
				return [a, parseInt(Math.random() * 30)];
			});
	}).map(function(x,x_i) { 
		return { data: x, label: state.buckets[x_i].disjunction[0] };
	});
}


function LemmaOrEntityTerm(a) {
	return OrTerm(LemmaTerm(a), EntityTerm(a));
}


function queryForModelState(state) {
	var query = { filter_: false, series_: [], buckets_:[] };
	var AndHelper = function(arr) { return arr.length > 1 ? {and_:{terms_: arr }} : arr[0]; };
	var OrHelper = function(arr) { return arr.length > 1 ? {or_:{terms_: arr }} : arr[0]; };
	var NotNull = function(a) { return a != null; };
	
	var WordToTerm = LemmaTerm;
	WordToTerm = function(a) { return OrTerm(LemmaTerm(a), EntityTerm(a)); };
	
	var t = state.filters
		.filter(function(x) { return (x.filterType == "text") && (x.disjunction.length) })
		.map(function(x) { return OrHelper(x.disjunction.filter(function(x) {return x != ""}).map(WordToTerm).filter(NotNull)); });
	
	t.push({date_:{before_:(state.endYear+1)*10000, after_:(state.startYear*10000 - 1)}});
	
	query.filter_ = AndHelper(t);
	
	/*
	query.filter_ = state.filters
		.filter(function(x) { return x.filterType == "text" })
		.map(function(x) { return x.disjunction.map(LemmaOrEntityTerm).filter(isNaN).reduce(OrTerm)})
		.reduce(AndTerm);
	*/
	
	query.series_ = state.buckets
		.filter(function(x) { return x.filterType == "text" && (x.disjunction.length) })
		.map(function(x) { return  OrHelper(x.disjunction.filter(function(x) {return x != ""}).map(WordToTerm)); }).filter(NotNull);
	
	/*
	query.series_ = state.buckets
		.filter(function(x) { return x.filterType == "text" })
		.map(function(x) { return x.disjunction.map(LemmaOrEntityTerm).filter(isNaN).reduce(OrTerm)}).filter(isNaN);
	*/
	
	if (state.horizontalAxis == "page") {
		query.buckets_ = array_range(1, 30).map(function(a) {
			return PageTerm(a,a+1);
		});
	} else if(state.dateGranularity == "year") {
		query.buckets_ = array_range(state.startYear, state.endYear).map(function(a) {
			return YearTerm(a);
		});
	} else if (state.dateGranularity == "month") {
		query.buckets_ = array_range(state.startYear, state.endYear).map(function(a) {
			return array_range(0,11).map(function(b) {
				return MonthTerm(a,b);
			});
		}).reduce(function(m,n) {
			return m.concat(n);
		});
	} else if (state.dateGranularity == "fixed #") {
		// ?
	}
	
	return query;
}

function addMockData() {
	var f = new SearchFilter();
	f.addLiteral("election");
	viewModel.addFilter(f);
	
	f = new SearchFilter();
	f.addLiteral("clinton");
	f.addLiteral("hillary");
	viewModel.addBucket(f);
	
	f = new SearchFilter();
	f.addLiteral("obama");
	f.addLiteral("hope");
	f.addLiteral("barack");
	viewModel.addBucket(f);
	
	f = new SearchFilter();
	f.addLiteral("mccain");
	viewModel.addBucket(f);
	
	viewModel.startYear(2006);
	viewModel.endYear(2009);
	
	viewModel.suggestions().push("mitt romney");
	viewModel.suggestions().push("palin");
	viewModel.suggestions().push("kucinich");
}




$("#slider-range").slider({
	range: true,
	min: 2000,
	max: 2010,
	values: [viewModel.startYear(), viewModel.endYear()],
	slide: function(event, ui) {
		viewModel.startYear(ui.values[0]);
		viewModel.endYear(ui.values[1])
	}
});

// Fix for two-way binding when the start/end years are changed. This might be brittle
function updateSlider() {
	$("#slider-range").slider({values: [viewModel.startYear(), viewModel.endYear()]});
}
viewModel.startYear.subscribe(updateSlider);
viewModel.endYear.subscribe(updateSlider);



function newFilterWithEmptyLiteralTo(f) {
	var n = new SearchFilter();
	n.addLiteral('');
	f(n);
}


$("#filterList").parent().find(".dropzone").droppable({
	accept: '.suggestion',
	activeClass: "filterListHover",
	drop: function(event, ui) {
			var n = new SearchFilter();
			n.addLiteral($(ui.draggable).text());
			viewModel.addFilter(n);
	}
});

$("#bucketList").parent().find(".dropzone").droppable({
	accept: '.suggestion',
	activeClass: "filterListHover",
	drop: function(event, ui) {
			var n = new SearchFilter();
			n.addLiteral($(ui.draggable).text());
			viewModel.addBucket(n);
	}
});

var debug;
function newInputsCallback() {
	$("input.justAdded").removeClass("justAdded").blur(queryChanged);
	$(".textFilterItem.justAdded").removeClass("justAdded").droppable({
		accept: '.suggestion',
		activeClass: "filterTextHover",
		drop: function(event, ui) {
			ko.dataFor(this).addLiteral($(ui.draggable).text());
		}
	});
}

viewModel.filters.subscribe(newInputsCallback);
viewModel.buckets.subscribe(newInputsCallback);

function suggestionsAdded() {
	$(".suggestion.justAdded").removeClass(".justAdded").draggable({helper: 'clone'});
}

viewModel.suggestions.subscribe(suggestionsAdded);

var current_generation = 0;
function queryChanged() {
	// will get called anytime the query gets changed in any way
	// we probably want to do some rate-limiting to avoid DoSing the server with queries
	viewModel.save();
    var query = queryForModelState(viewModel.toPlainObject());
    arbitraryQuery("/api/query/docs/bucketed",    
        query,
        function(gen,query,c,r,d){
            if(!success(c)) {
                alert("query failed to run: " + r);
                alert(JSON.stringify(query));
                return;
            }
            if(gen != current_generation)
                return;
            //TODO: maybe a better way to do this
            if(viewModel.horizontalAxis() == "date") {
                if(viewModel.dateGranularity() == "year") {
                    viewModel.graphData(
                        r
                        .map(function(x, x_i) {
                            
                            return {data: x.map(function(y,y_i) {
                                return [new Date(viewModel.startYear()+y_i,0,0).getTime(),y];
                            }), label: viewModel.buckets()[x_i].disjunction()[0]() };
                        }));
                } else if(viewModel.dateGranularity() == "month") {
                    viewModel.graphData(
                        r
                        .map(function(x, x_i) {
                            
                            return {data: x.map(function(y,y_i) {
                                return [new Date(viewModel.startYear(),y_i,0).getTime(),y];
                            }), label: viewModel.buckets()[x_i].disjunction()[0]() };
                        }));
                } else {
                    //?
                }
            } else if(viewModel.horizontalAxis() == "page") {
                viewModel.graphData(
                    r
                    .map(function(x, x_i) {
                        
                        return {data: x.map(function(y,y_i) {
                            return [y_i + 1,y];
                        }), label: viewModel.buckets()[x_i].disjunction()[0]() };
                    }));
            } else {
                //?
            }
        }.bind(this, ++current_generation, query));
}




addMockData();
ko.applyBindings(viewModel);

viewModel.filters.subscribe(queryChanged);
viewModel.buckets.subscribe(queryChanged);
viewModel.startYear.subscribe(queryChanged);
viewModel.endYear.subscribe(queryChanged);
viewModel.horizontalAxis.subscribe(queryChanged);
viewModel.dateGranularity.subscribe(queryChanged);
viewModel.dateGranularityFixed.subscribe(queryChanged);
queryChanged();


//viewModel.graphData(fakeData(viewModel.toPlainObject()));
updatePlot();
suggestionsAdded();
newInputsCallback();

	viewModel.graphData(
		[[465,679,1311,293],[1263,1101,3475,2150],[135,194,1581,72]]
		.map(function(x, x_i) {
			
			return {data: x.map(function(y,y_i) {
				return [new Date(viewModel.startYear()+y_i,0,0).getTime(),y];
			}), label: viewModel.buckets()[x_i].disjunction()[0]() };
		}));
