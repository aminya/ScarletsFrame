// Allow direct function replacement to accelerate development
// Note: this feature will allocate more small memory and small slow down
let hotReloadAll = false; // All model property

let proxyModel, proxySpace, proxyComponent, proxyTemplate, internalProp;
let backupTemplate, backupCompTempl;

;(function(){
const gEval = routerEval;

sf.hotReload = function(mode){
	if(mode === 1)
		hotReload = true;
	else if(mode === 2)
		hotReloadAll = hotReload = true;

	if(proxyModel !== void 0) return;

	backupTemplate = {};
	backupCompTempl = new WeakMap();
	proxyModel = new WeakMap();
	proxyComponent = new WeakMap();
	proxyTemplate = {};
	proxySpace = new WeakMap(/*
		(Space) => {compName:[scopes]}
	*/);

	internalProp = {};
	['init', 'reinit', 'destroy', '$el'].forEach(function(val){
		internalProp[val] = true;
	});

	$(function(){
		backupTemplate = Object.assign({}, templates);

		// Register event
		setTimeout(function(){
			if(window.___browserSync___ !== void 0){
				const { socket } = window.___browserSync___;
				socket.on('sf-hot-js', gEval);
				socket.on('sf-hot-html', gEval);
			}
			else console.error("HotReload: Failed to listen to browserSync");
		}, 1000);
	});
}

})();

const haveLoaded = new WeakSet();
function reapplyScope(proxy, space, scope, func, forceHaveLoaded){
	function refunction(prop, replacement){
		let proxier = proxy[prop];
		if(proxier === void 0){
			if(scope[prop] && scope[prop].ref !== void 0)
				proxier = proxy[prop] = scope[prop];
			else{
				proxier = proxy[prop] = function(){
					return proxier.ref.apply(this, arguments);
				}
			}
		}

		if(proxier.protoFunc !== void 0)
			proxier.ref = replacement || proxier.ref;
		else{
			const ref = (replacement || scope[prop]);

			if(proxier !== ref)
				proxier.ref = ref;
		}

		scope[prop] = proxier;
	}

	// Keep component's original scope for first time only
	if(func === void 0){
		for(let prop in scope){
			if(internalProp[prop] === true) // Skip function that related with framework
				continue;

			if(scope[prop] && scope[prop].constructor === Function)
				refunction(prop);
		}
		return;
	}

	scope.hotReloading && scope.hotReloading(scope);

	if(func.constructor === Function){
		let enabled = true;
		func(new Proxy(scope, {set(obj, prop, val){
			// Skip function that related with framework
			// And skip if proxy is not enabled
			if(enabled === false || internalProp[prop] === true){
				obj[prop] = val;
				return true;
			}

			if(val && val.constructor === Function)
				refunction(prop, val);
			else if(obj[prop] === void 0 || hotReloadAll === true)
				obj[prop] = val; // Reassign non-function value

			return true;
		}}), space, (scope.$el && scope.$el.$item) || {});
		enabled = false;
	}
	else Object.setPrototypeOf(scope, func.class.prototype);

	if(haveLoaded.has(scope) || forceHaveLoaded)
		scope.hotReloaded && scope.hotReloaded(scope);
	else
		haveLoaded.add(scope);
}

// On model scope reregistered
function hotModel(space, name, func){
	const scope = space(name);
	let proxy = proxyModel.get(scope);

	// If new model
	if(proxy === void 0 || !scope){
		proxy = {}; // we will only put function here
		proxyModel.set(scope, proxy);
	}

	reapplyScope(proxy, space, scope, func);
}

// On new component created
function hotComponentAdd(space, name, scope){
	let proxy = proxySpace.get(space);

	// If new space
	if(proxy === void 0){
		proxy = {};
		proxySpace.set(space, proxy);
	}

	let list = proxy[name];
	if(list === void 0)
		list = proxy[name] = [];

	list.push(scope);

	proxy = {};
	proxyComponent.set(scope, proxy);

	reapplyScope(proxy, scope, scope);
}

function hotComponentRemove(el){
	const proxy = proxySpace.get(el.sf$space);
	if(proxy === void 0)
		return;

	const list = proxy[el.sf$controlled];
	list.splice(list.indexOf(el.model), 1);
}

// On component scope reregistered
function hotComponentRefresh(space, name, func){
	let list = proxySpace.get(space);
	if(list === void 0 || list[name] === void 0)
		return;

	list = list[name];

	for (let i = 0; i < list.length; i++){
		let proxy = proxyComponent.get(list[i]);
		if(proxy === void 0){
			proxy = {};
			proxyComponent.set(list[i], proxy);
		}

		reapplyScope(proxy, space, list[i], func, true);
	}
}

// For views and component template
// The element will be destroyed and created a new one
// The scope will remain same, and hotReloaded will be called

// Refresh views html and component
function hotTemplate(templates){
	const vList = sf.views.list;
	const changes = {};

	for(let path in templates){
		if(backupTemplate[path] === void 0 || backupTemplate[path] === templates[path])
			continue;

		const forComp = proxyTemplate[path]; // [space, name]
		if(forComp !== void 0){
			const _space = forComp[0];
			const _name = forComp[1];
			const registrar = _space.registered[_name];

			if(registrar !== void 0 && registrar[3] !== void 0){
				const old = registrar[3].outerHTML;
				sf.component.html(_name, {template:path}, _space);
				const now = registrar[3].outerHTML;

				if(now !== old
				   || (backupCompTempl.has(registrar)
				       && now !== backupCompTempl.get(registrar).outerHTML)
				   )
					hotComponentTemplate(_space, _name);
			}

			continue;
		}

		// for views only
		changes[path] = true;
	}

	for(let name in vList){
		const { routes } = vList[name];
		const sfPageViews = $('sf-page-view', vList[name].rootDOM);

		for (let i = 0; i < sfPageViews.length; i++) {
			const page = sfPageViews[i];
			const pageTemplate = page.sf$templatePath;
			if(pageTemplate === void 0 || changes[pageTemplate] === void 0)
				continue;

			page.innerHTML = templates[pageTemplate];

			page.routeCached.html = sf.dom.parseElement(`<template>${templates[pageTemplate]}</template>`, true)[0];

			// Replace with the old nested view
			const nesteds = page.sf$viewSelector;
			for(let nested in nesteds){
				const el = page.querySelector(nested);
				el.parentNode.replaceChild(nesteds[nested], el);
			}
		}
	}

	backupTemplate = Object.assign({}, templates);
}

internal.hotTemplate = hotTemplate;

// Refresh component html
function hotComponentTemplate(scope, name){
	const registrar = scope.registered[name];
	const freezed = registrar[2].slice(0); // freeze to avoid infinity loop if have any nest

	for (let z = 0; z < freezed.length; z++) {
		const model = freezed[z];
		const els = model.$el;

		for (let k = 0; k < els.length; k++) {
			const element = els[k];

			// Don't refresh component that not declared with sf.component.html
			if(element.sf$elementReferences === void 0)
				continue;

			const { parentNode } = element;
			const nextNode = element.nextSibling;

			// Detach from DOM tree first
			if(parentNode !== null)
				element.remove();
			element.textContent = '';

			// Clear old DOM linker
			internal.model.removeModelBinding(model);

			let temp = registrar[3];
			if(registrar[3].constructor !== Object){
				var { tempDOM } = temp;

				temp = prepareComponentTemplate(temp, tempDOM, name, model, registrar);
				({ tempDOM } = temp);
			}

			// Create new object, but using registrar[3] as prototype
			const copy = Object.create(temp);

			if(copy.parse.length !== 0){
				copy.parse = copy.parse.slice(0);

				// Deep copy the original properties to new object
				for (let i = 0; i < copy.parse.length; i++) {
					copy.parse[i] = Object.create(copy.parse[i]);
					copy.parse[i].data = [null, model];
				}
			}

			if(tempDOM === true)
				var parsed = internal.model.templateParser(copy, model, void 0, void 0, void 0, element);
			else{
				var parsed = internal.model.templateParser(copy, model);
				element.appendChild(parsed);
			}

			element.sf$elementReferences = parsed.sf$elementReferences;
			sf.model.bindElement(element, model, copy);

			// Put it back after children was ready
			if(parentNode !== null)
				parentNode.insertBefore(element, nextNode);
		}

		model.hotReloadedHTML && model.hotReloadedHTML();
	}

	backupCompTempl.set(registrar, registrar[3]);
}