;(function(){
var gEval = routerEval;
routerEval = void 0; // Avoid this function being invoked out of scope

// Save reference
var aHashes = sf.url.hashes;
var slash = '/';

var routingError = false;
var routeDirection = 1;
var historyIndex = (window.history.state || 1);

var disableHistoryPush = false;

window.addEventListener('popstate', function(ev){
	// Don't continue if the last routing was error
	// Because the router was trying to getting back
	if(routingError){
		routingError = false;
		historyIndex -= routeDirection;
		return;
	}

	disableHistoryPush = true;

	// Reparse URL
	sf.url.parse();
	var list = self.list;

	if(window.history.state >= historyIndex)
		routeDirection = 1;
	else
		routeDirection = -1;

	historyIndex += routeDirection;

	// console.warn('historyIndex', historyIndex, window.history.state, routeDirection > 0 ? 'forward' : 'backward');

	// For root path
	list[slash].goto(sf.url.paths);

	// For hash path
	var keys = Object.keys(aHashes);
	for (var i = 0; i < keys.length; i++) {
		var temp = list[keys[i]];
		if(temp === void 0) continue;

		temp.goto(aHashes[keys[i]]);
	}

	disableHistoryPush = false;
}, false);

internal.router = {};
internal.router.parseRoutes = function(obj_, selectorList){
	var routes = [];
	var pattern = /\/:([^/]+)/;
	var sep = /\-/;
    var knownKeys = /path|url|on|routes|beforeRoute|defaultData/;

	function addRoutes(obj, addition, selector, parent){
		if(selector !== '')
			selector += ' ';

		for(var i = 0; i < obj.length; i++){
            var ref = obj[i];
			var current = addition+ref.path;

			if(ref.routes !== void 0){
				addRoutes(ref.routes, current, selector, parent);
				continue;
			}

			var keys = [];
			var regex = current.replace(pattern, function(full, match){
				keys.push(match);
				return '/([^/]+)';
			});
			var route = RegExp('^' + regex + '$');

			route.url = ref.url;
			route.keys = keys;
			route.beforeRoute = ref.beforeRoute;
			route.defaultData = ref.defaultData || {};

			if(selector !== ''){
				route.selector = selectorList.indexOf(selector);

				if(route.selector === -1){
					route.selector = selectorList.length;
					selectorList.push(selector.trim());
				}
			}

			if(parent !== void 0)
				route.parent = parent;

			if(ref.on !== void 0)
				route.on = ref.on;

			var hasChild = [];

            var keys = Object.keys(ref);
            for(var a = 0; a < keys.length; a++){
                if(knownKeys.test(keys[a]))
                  continue;

				hasChild.push(keys[a]);
				addRoutes(ref[keys[a]], current, keys[a], route);
                break;
            }

            if(hasChild.length !== 0){
            	route.hasChild = hasChild;
            	route.forChild = RegExp(regex);
            }

			routes.push(route);
		}
	}

    addRoutes(obj_, '', '');
	return routes;
}

internal.router.findRoute = function(url){
	for(var i=0; i<this.length; i++){
		var found = url.match(this[i]);
		if(found !== null){
			var keys = this[i].keys;
			if(keys !== void 0){
				var data = this[i].data = {};
				found.shift();

				for (var a = 0; a < keys.length; a++) {
					data[keys[a]] = found[a];
				}
			}

			return this[i];
		}
	}

	return false;
}

var self = sf.views = function View(selector, name){
	if(name === void 0)
		name = slash;

	var self = sf.views.list[name] = this;

	// Init current URL as current View Path
	if(name === slash)
		self.currentPath = sf.url.paths;
	else
		self.currentPath = sf.url.hashes[name] || '/';

	var initialized = false;
	var selectorElement = {};

	self.lastPath = '/';
	self.currentDOM = null;
	self.lastDOM = null;
	self.relatedDOM = [];

	self.maxCache = 2;

	var rootDOM = {};
	self.selector = function(selector_, isChild){
		initialized = true;

		var DOM = (isChild || (rootDOM.isConnected ? rootDOM : document)).querySelector(selector_ || selector);

		if(DOM.viewInitialized)
			return;

		// Create listener for link click
		if(DOM){
			if(selector_)
				selector = selector_;

			// Bring the content to an sf-page-view element
			var temp = document.createElement('sf-page-view');
			DOM.insertBefore(temp, DOM.firstChild);

			for (var i = 1, n = DOM.childNodes.length; i < n; i++) {
				temp.appendChild(DOM.childNodes[1]);
			}

			temp.routePath = self.currentPath;
			temp.routeCached = routes.findRoute(temp.routePath);
			temp.classList.add('page-current');

			DOM.viewInitialized = true;

			if(!isChild){
				self.currentDOM = temp;
				$.on(DOM, 'click', 'a[href]', hrefClicked);
				rootDOM = DOM;
			}
			else{
				selectorElement[selector_] = DOM;
				return DOM;
			}

			return true;
		}
		return false;
	}

    var selectorList = [selector];
	var routes = [];
	routes.findRoute = internal.router.findRoute;

	internal.router.enabled = true;

	var onEvent = {
		'routeStart':[],
		'routeFinish':[],
		'routeCached':[],
		'routeError':[]
	};

	self.on = function(event, func){
		if(onEvent[event] === void 0)
			return console.error("Event '"+event+"' was not exist");

		if(onEvent[event].indexOf(func) === -1)
			onEvent[event].push(func);
	}

	self.addRoute = function(obj){
		routes.push(...internal.router.parseRoutes(obj, selectorList));

		if(!initialized)
			self.selector();
	}

	function hrefClicked(ev){
		var elem = ev.target;
		var attr = elem.getAttribute('href');

		if(attr[0] === '@'){ // ignore
			var target = elem.getAttribute('target');
			if(target)
				window.open(attr.slice(1), target);
			else window.location = attr.slice(1);
			return;
		}

		if(attr[0] === '#'){
			ev.preventDefault();
			var keys = attr.slice(1).split('#');
			for (var i = 0; i < keys.length; i++) {
				var key = keys[i].split(slash);
				var ref = sf.views.list[key.shift()];

				if(ref !== void 0){
					key = key.join(slash);
					if(ref.currentPath !== key)
						ref.goto(key);
				}
			}
		}

		// Make sure it's from current origin
		var path = elem.href.replace(window.location.origin, '');
		if(path.indexOf('//') !== -1)
			return;

		ev.preventDefault();
		if(self.currentPath === path)
			return;

		if(!self.goto(path))
			console.error("Couldn't navigate to", path, "because path not found");
	}

	var RouterLoading = false; // xhr reference if the router still loading

	function routeError_(xhr, data){
		if(xhr.aborted) return;
		routingError = true;

		RouterLoading = false;
		for (var i = 0; i < onEvent['routeError'].length; i++) {
			onEvent['routeError'][i](xhr.status, data);
		}

		window.history.go(routeDirection * -1);
	}

	var pageViewNodeName = 'SF-PAGE-VIEW';
	function toBeShowed(element){
		var relatedPage = [];

		var parent = element.parentElement;
		while(parent !== rootDOM && parent !== null){
			if(parent.nodeName === pageViewNodeName)
				relatedPage.unshift(parent);

			parent = parent.parentElement;
		}

		for (var i = 0; i < self.relatedDOM.length; i++) {
			if(relatedPage.indexOf(self.relatedDOM[i]) === -1){
				self.relatedDOM[i].classList.add('page-hidden');
				self.relatedDOM[i].classList.remove('page-current');
			}
		}

		for (var i = 0; i < relatedPage.length; i++) {
			relatedPage[i].classList.add('page-current');
			relatedPage[i].classList.remove('page-hidden');
		}

		element.classList.add('page-current');
		element.classList.remove('page-hidden');

		relatedPage.push(element);
		self.relatedDOM = relatedPage;
	}

	self.goto = function(path, data, method, _callback){
		if(self.currentPath === path)
			return;

		// Get template URL
		var url = routes.findRoute(path);
		if(!url) return;

		if(url.beforeRoute !== void 0)
			url.beforeRoute(url.data);

		if(name === slash)
			sf.url.paths = path;
		else
			aHashes[name] = path;

		// This won't trigger popstate event
		if(!disableHistoryPush)
			sf.url.push();

		// Check if view was exist
		if(!rootDOM.isConnected){
			if(rootDOM.nodeType !== void 0)
				rootDOM = {};

			if(!self.selector());
				return console.error(name, "can't route to", path, "because element with selector '"+selector+"' was not found");
		}

		// Abort other router loading if exist
		if(RouterLoading) RouterLoading.abort();

		// Return if the cache was exist
		if(tryCache(path)) return true;

		for (var i = 0; i < onEvent['routeStart'].length; i++) {
			if(onEvent['routeStart'][i](self.currentPath, path)) return;
		}

		function insertLoadedElement(DOMReference, dom, parentElement, pendingShowed){
			if(parentElement)
				dom.parentPageElement = parentElement;

			dom.routerData = null;
			if(dom.firstChild.nodeName === '#comment' && dom.firstChild.textContent.indexOf(' SF-View-Data') === 0){
				dom.routerData = JSON.parse(dom.firstChild.textContent.slice(14));
				dom.firstChild.remove();
			}

			// Let page script running first
			DOMReference.insertAdjacentElement('beforeend', dom);

			try{
				if(self.dynamicScript !== false){
					var scripts = dom.getElementsByTagName('script');
					for (var i = 0; i < scripts.length; i++) {
					    gEval(scripts[i].text);
					}
				}

				// Parse the DOM data binding
				sf.model.init(dom);

				// Trigger loaded event
				for (var i = 0; i < onEvent['routeFinish'].length; i++) {
					if(onEvent['routeFinish'][i](self.currentPath, path, url.data)) return;
				}
			}catch(e){
				console.error(e);
				dom.remove();
				return routeError_({status:0});
			}

			if(url.on !== void 0 && url.on.coming)
				url.on.coming(url.data);

			dom.removeAttribute('style');
			toBeShowed(dom);

			if(pendingShowed !== void 0)
				self.relatedDOM.push(...pendingShowed);

			if(self.currentDOM !== null){
				self.lastPath = self.currentPath;

				// Old route
				if(self.currentDOM.routeCached.on !== void 0 && self.currentDOM.routeCached.on.leaving)
					self.currentDOM.routeCached.on.leaving();

				self.lastDOM = self.currentDOM;
			}

			// Save current URL
			self.currentPath = path;
			dom.routeCached = url;
			dom.routePath = path;

			dom.classList.remove('page-prepare');

			self.currentDOM = dom;
			routingError = false;

			// Clear old cache
			var parent = self.currentDOM.parentNode;
			for (var i = parent.childElementCount - self.maxCache - 1; i >= 0; i--) {
				parent.firstElementChild.remove();
			}
		}

		RouterLoading = sf.ajax({
			url:window.location.origin + (url.url || path),
			method:method || 'GET',
		    data:Object.assign(data || url.defaultData, {
		        _sf_view:url.selector === void 0 ? selector : selectorList[url.selector].split(' ').pop()
		    }),
			success:function(html_content){
				// Create new element
				var dom = document.createElement('sf-page-view');
				dom.innerHTML = html_content;
				dom.classList.add('page-prepare');
				dom.style.display = 'none';

				if(url.selector === void 0)
					var DOMReference = rootDOM;

				else{ // Get element from selector
					var DOMReference = selectorElement[selectorList[url.selector]];
					if(!DOMReference || !DOMReference.isConnected){
						if(url.parent === void 0){
							dom.remove();
							return routeError_({status:0});
						}
						else{
							// Try to load parent router first
							var newPath = path.match(url.parent.forChild)[0];
							return self.goto(newPath, false, method, function(parentElement){
								insertLoadedElement(selectorElement[selectorList[url.selector]], dom, parentElement);
							});
						}
					}
				}

				if(url.hasChild){
					var pendingShowed = [];
					for (var i = 0; i < url.hasChild.length; i++) {
						selectorElement[url.hasChild[i]] = self.selector(url.hasChild[i], dom);
						var tempPageView = selectorElement[url.hasChild[i]].firstElementChild;

						if(tempPageView)
							pendingShowed.unshift(tempPageView);
					}

					if(pendingShowed.length === 0)
						pendingShowed = void 0;
				}
				else var pendingShowed = void 0;

				insertLoadedElement(DOMReference, dom, false, pendingShowed);
				if(_callback) _callback(dom);
			},
			error:routeError_
		});
		return true;
	}

	// Use to cache if exist
	function tryCache(path){
		var cachedDOM = false;

		function findDOM(dom){
			if(dom === null)
				return false;

			var childs = dom.children;
			for (var i = 0; i < childs.length; i++) {
				if(childs[i].routePath === path){
					cachedDOM = childs[i];
					// console.warn('cache found for', path, childs[i]);
					return true;
				}
			}
			return false;
		}

		if(findDOM(rootDOM) === false)
			for (var i = 0; i < selectorList.length; i++) {
				if(findDOM(rootDOM.querySelector(selectorList[i])))
					break;
			}

		if(cachedDOM === false)
			return false;

		if(self.currentDOM.routeCached.on !== void 0 && self.currentDOM.routeCached.on.leaving)
			self.currentDOM.routeCached.on.leaving();

		toBeShowed(cachedDOM);
		self.currentDOM = cachedDOM;

		if(self.currentDOM.routeCached.on !== void 0 && self.currentDOM.routeCached.on.coming)
			self.currentDOM.routeCached.on.coming();

		for (var i = 0; i < onEvent['routeCached'].length; i++) {
			if(onEvent['routeCached'][i](self.currentPath, self.lastPath)) return;
		}

		// Trigger reinit for the model
		var reinitList = self.currentDOM.querySelectorAll('[sf-controller]');
		var models = sf.model.root;
		for (var i = 0; i < reinitList.length; i++) {
			var modelName = reinitList[i].getAttribute('sf-controller') || reinitList[i].sf$component;
			if(models[modelName].reinit)
				models[modelName].reinit();
		}

		self.lastPath = self.currentPath;
		self.currentPath = self.currentDOM.routePath;

		return true;
	}

	return self;
}

sf.views.list = {};

})();