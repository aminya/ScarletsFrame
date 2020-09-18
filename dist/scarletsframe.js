if(Element.prototype.remove === void 0 || CharacterData.prototype.remove === void 0 || DocumentType.prototype.remove === void 0){
	(function(){
		const arr = [Element.prototype, CharacterData.prototype, DocumentType.prototype];
		for (let i = 0; i < arr.length; i++) {
			if(arr[i].hasOwnProperty('remove'))
				return;

			arr[i].remove = function(){
				if(this.parentNode !== null)
					this.parentNode.removeChild(this);
			}
		}
	})();
}

if(Element.prototype.matches === void 0)
	Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;

if(Element.prototype.closest === void 0){
	Element.prototype.closest = function(selector){
		let elem = this;
		do {
			if(elem === document)
				return null;

			if(elem.matches(selector) === true)
				return elem;

			elem = elem.parentNode;
		} while (elem !== null);

		return null;
	}
}
(function(global, factory){
  // Check browser feature
  if(HTMLElement.prototype.remove === void 0 || window.customElements === void 0 || window.Reflect === void 0){
	console.error("This browser was not supported");

	if(window.customElements === void 0)
		console.warn("This can be fixed by adding 'https://unpkg.com/@webcomponents/webcomponentsjs@2.3.0/webcomponents-loader.js' before loading 'scarletsframe.js'");

	if(window.Reflect === void 0)
		console.warn("This can be fixed by adding 'https://unpkg.com/core-js-bundle@3.4.0/minified.js' before loading 'scarletsframe.js'");

	alert("This browser was not supported");
  }

  // Dynamic script when using router to load template
  // Feature is disabled by default
  function routerEval(code){eval(code)}

  if(typeof exports === 'object' && typeof module !== 'undefined') module.exports = factory(global, routerEval);
  else global.sf = factory(global, routerEval);
}(typeof window !== "undefined" ? window : this, (function(window, routerEval){

'use strict';

if(typeof document === void 0)
	document = window.document;

var HTMLTemplates = window.templates || {};
var TemplatePending = [];
Object.defineProperty(window, 'templates', {
	set: function(val){
		HTMLTemplates = val;
		hotReload && internal.hotTemplate(val);

		if(TemplatePending.length !== 0){
			var temp = TemplatePending;
			TemplatePending = [];

			for (var i = 0; i < temp.length; i++)
				temp[i]();
		}
	},
	get: function(){
		return HTMLTemplates;
	}
});

// ===== Module Init =====
var internal = {};
var privateRoot = {};
var forProxying = {};

var sf = function(stuff, returnNode){
	// If it's Node type
	if(stuff.tagName !== void 0){
		if(stuff.nodeType !== 1 || stuff.sf$controlled === void 0)
			stuff = $.parentHasProperty(stuff, 'sf$controlled');

		if(stuff === null)
			return stuff;

		if(returnNode)
			return stuff;
		return stuff.model;
	}
};

var hotReload = false;
var sfRegex = {
	getQuotes:/(['"])(?:\1|[\s\S]*?[^\\]\1)/g,
	scopeVar:'(^|[^.\\]\\w])',
	// escapeHTML:/(?!&#.*?;)[\u00A0-\u9999<>\&]/gm,

	uniqueDataParser:/{{((@|#[\w])[\s\S]*?)}}/g,
	dataParser:/{{([^@%][\s\S]*?)}}/g,

	repeatedList:/(.*?) in (.*?)$/,
	itemsObserve:/\b(_model_|_modelScope)\.([\w\[\].]+)/g,
	parsePropertyPath:/(?:\[([\w]+)\]|\.([\w]+))/g,
	getSingleMask:['([^\\w.]|^)','([^\\w:]|$)'], //gm

	inputAttributeType:/checkbox|radio|hidden/,
	anyCurlyBracket:/{{.*?}}/,
	allTemplateBracket:/{\[([\s\S]*?)\]}/g,
	anyOperation:/[ =(+-]/,
};

;(function(){
	function createScope(value){
		return {configurable:true, enumerable:true,
			get:function(){return value},
			set:function(val){
				value = val;
			}
		};
	}

	sf.link = function(obj, key, val){
		var candidate = false;

		function check(temp){
			if(temp === void 0)
				return;

			if(temp.set !== void 0){
				// Can we handle it?
				if(candidate !== false && temp.set !== candidate.set)
					throw new Error("There are more than one object that have different set descriptor");

				candidate = temp;
				return;
			}

			if(candidate === false && val === void 0)
				val = temp.value;
		}

		if(obj.constructor === Array)
			for (var i = 0; i < obj.length; i++)
				check(Object.getOwnPropertyDescriptor(obj[i], key));
		else
			for(var key in obj)
				check(Object.getOwnPropertyDescriptor(obj[key], key));

		if(candidate === false)
			candidate = createScope(val);

		if(obj.constructor === Array)
			for (var i = 0; i < obj.length; i++)
				Object.defineProperty(obj[i], key, candidate);
		else
			for(var key in obj)
				Object.defineProperty(obj[key], key, candidate);
	}
})();

function parsePropertyPath(str){
	var temp = [];
	temp.unshift(str.replace(sfRegex.parsePropertyPath, function(full, g1, g2){
		if(g1 !== void 0){
			if(isNaN(g1) === false)
				g1 = Number(g1);
			else if(g1[0] === '"' || g1[0] === "'")
				g1 = g1.slice(1, -1);

			temp.push(g1);
			return '';
		}

		temp.push(g2);
		return '';
	}));

	return temp;
}

function stringifyPropertyPath(properties){
	var remake = properties[0];
	for (var i = 1; i < properties.length; i++) {
		if(properties[i].constructor === Number)
			remake += '['+properties[i]+']';
		else
			remake += '.'+properties[i];
	}

	return remake;
}

var _es = '%@~';
function avoidQuotes(str, func, onQuotes){
	str = str.split(_es).join('-');

	var temp = [];
	str = str.replace(sfRegex.getQuotes, function(full){
		temp.push(full);
		return _es+(temp.length-1)+_es;
	});

	if(temp.length === 0)
		return func(str);

	str = func(str);

	if(onQuotes !== void 0){
		for (var i = 0; i < temp.length; i++)
			str = str.replace(_es+i+_es, onQuotes(temp[i]));
	}
	else{
		for (var i = 0; i < temp.length; i++)
			str = str.replace(_es+i+_es, temp[i]);
	}

	return str;
}

function isEmptyObject(obj){
	for(var key in obj){
		return false;
	}
	return true
}

function compareObject(obj1, obj2){
	if(obj1 === obj2)
		return true;

	if(!obj1 || !obj2)
		return false;

	if(obj1.constructor === Array){
		if(obj1.length !== obj2.length)
			return false;

		for (var i = 0; i < obj1.length; i++) {
			if(obj1[i] !== obj2[i])
				return false;
		}

		return true;
	}

	var o1 = Object.keys(obj1);
	var o2 = Object.keys(obj2);

	if(o1.length !== o2.length)
		return false;

	var n = o1.length < o2.length ? o2 : o1;
	for (var i = 0; i < n.length; i++) {
		if(obj1[n[i]] !== obj2[n[i]])
			return false;
	}

	return true;
}

function hiddenProperty(obj, property, value, isWritable){
	Object.defineProperty(obj, property, {
		enumerable: false,
		configurable: true,
		writable: isWritable,
		value: value
	});
}

function deepProperty(obj, path){
  for(var i = 0; i < path.length; i++){
	obj = obj[path[i]];
	if(obj === void 0) return;
  }
  return obj;
}

function capitalizeLetters(name){
	for (var i = 0; i < name.length; i++) {
		name[i] = name[i][0].toUpperCase() + name[i].slice(1);
	}
	return name.join('');
}

function getStaticMethods(keys, clas){
	var keys2 = Object.getOwnPropertyNames(clas);

	for(var i = 0; i < keys2.length; i++){
		if(typeof clas[keys2[i]] === 'function')
			keys.add(keys2[i]);
	}
}

function getPrototypeMethods(keys, clas){
	if(clas.prototype === void 0)
		return;

	var keys2 = Object.getOwnPropertyNames(clas.prototype);
	for (var i = keys2.length - 1; i >= 0; i--) {
		if(keys2[i] !== 'constructor')
			keys.add(keys2[i]);
	}

	var deep = Object.getPrototypeOf(clas);
	if(deep.prototype !== void 0)
		getPrototypeMethods(keys, deep);
}

function proxyClass(scope){
	var parent = scope.constructor;
	var proto = parent.prototype;

	var list = new Set();
	getPrototypeMethods(list, parent);

	for(var key of list){
		// Proxy only when child method has similar name with the parent
		if(scope[key] !== proto[key] && scope[key].ref === void 0){
			let tempProxy = function(){
				scope.super = tempProxy.protoFunc;
				return tempProxy.ref.apply(scope, arguments);
			}

			tempProxy.ref = scope[key];
			tempProxy.protoFunc = proto[key];

			scope[key] = tempProxy;
		}
	}
}

// Faster than Array.from on some condition
function toArray(b){
	var c = new Array(b.length);
	for(var i=0; i<c.length; i++)
		c[i] = b[i];

	return c;
}
sf.loader = new function(){
	const self = this;
	self.loadedContent = 0;
	self.totalContent = 0;
	self.DOMWasLoaded = false;
	self.DOMReady = false;
	self.turnedOff = true;

	let whenDOMReady = [];
	let whenDOMLoaded = [];
	let whenProgress = [];

	// Make event listener
	self.onFinish = function(func){
		if(self.DOMWasLoaded) return func();
		if(whenDOMLoaded.includes(func)) return;
		whenDOMLoaded.push(func);
	}
	self.domReady = function(func){
		if(self.DOMReady) return func();
		if(whenDOMReady.includes(func)) return;
		whenDOMReady.push(func);
	}
	self.onProgress = function(func){
		if(self.DOMWasLoaded) return func(self.loadedContent, self.totalContent);
		if(whenProgress.includes(func)) return;
		whenProgress.push(func);
	}

	self.f = function(ev){
		self.loadedContent++;

	    ev.target.removeEventListener('load', self.f, {once:true});
	    ev.target.removeEventListener('error', self.f, {once:true});

		for (let i = 0; i < whenProgress.length; i++)
			whenProgress[i](self.loadedContent, self.totalContent);
	}

	self.css = function(list){
		if(self.DOMWasLoaded){
			// check if some list was loaded
			for (var i = list.length - 1; i >= 0; i--) {
				if(document.querySelectorAll(`link[href*="${list[i]}"]`).length !== 0)
					list.splice(i, 1);
			}
			if(list.length === 0) return;
		}
		self.turnedOff = false;

		self.totalContent = self.totalContent + list.length;
		for(var i = 0; i < list.length; i++){
			const s = document.createElement('link');
	        s.rel = 'stylesheet';
	        s.href = list[i];
	        s.addEventListener('load', self.f, {once:true});
	        s.addEventListener('error', self.f, {once:true});
	        document.head.appendChild(s);
		}
	}

	self.js = function(list, async){
		if(self.DOMWasLoaded){
			// check if some list was loaded
			for (var i = list.length - 1; i >= 0; i--) {
				if(document.querySelectorAll(`script[src*="${list[i]}"]`).length !== 0)
					list.splice(i, 1);
			}
			if(list.length === 0) return;
		}
		self.turnedOff = false;

		self.totalContent = self.totalContent + list.length;
		for(var i = 0; i < list.length; i++){
			const s = document.createElement('script');
	        s.type = "text/javascript";
	        if(async) s.async = true;
	        s.src = list[i];
	        s.addEventListener('load', self.f, {once:true});
	        s.addEventListener('error', self.f, {once:true});
	        document.head.appendChild(s);
		}
	}

	let lastState = '';
	self.waitImages = function(){
		lastState = 'loading';
	}

	function domLoadEvent(event){
		// Add processing class to queued element
		if(document.body){
			document.removeEventListener('load', domLoadEvent, true);

			if(lastState === 'loading'){ // Find images
				const temp = document.body.querySelectorAll('img:not(onload)[src]');
				for (let i = 0; i < temp.length; i++) {
					self.totalContent++;
					temp[i].addEventListener('load', self.f, {once:true});
					temp[i].addEventListener('error', self.f, {once:true});
				}
			}
		}
	}

	document.addEventListener("load", domLoadEvent, true);

	function domStateEvent(){
		if(document.readyState === 'interactive' || document.readyState === 'complete'){
			if(self.DOMReady === false){
				self.DOMReady = true;
				for (let i = 0; i < whenDOMReady.length; i++) {
					try{
						whenDOMReady[i]();
					} catch(e) {
						console.error(e);
						sf.onerror && sf.onerror(e);
					}
				}
			}

			if(self.turnedOff === false)
				resourceWaitTimer = setInterval(waitResources, 100);
			else waitResources();

			document.removeEventListener('readystatechange', domStateEvent, true);
		}
	}

	if(document.readyState === 'interactive' || document.readyState === 'complete'){
		document.removeEventListener('load', domLoadEvent, true);

		// Wait until all module has been loaded
		setTimeout(domStateEvent, 1);
	}
	else document.addEventListener('readystatechange', domStateEvent, true);

	var resourceWaitTimer = -1;
	function waitResources(){
		if(self.turnedOff === false && self.loadedContent < self.totalContent)
			return;

		clearInterval(resourceWaitTimer);

		const listener = document.querySelectorAll('script, link, img');
		for (var i = 0; i < listener.length; i++) {
			listener[i].removeEventListener('error', self.f);
			listener[i].removeEventListener('load', self.f);
		}

		self.DOMWasLoaded = true;
		self.turnedOff = true;

		for (var i = 0; i < whenDOMLoaded.length; i++) {
			try{
				whenDOMLoaded[i]();
			} catch(e){
				console.error(e);
				sf.onerror && sf.onerror(e);
			}
		}

		whenProgress = whenDOMReady = whenDOMLoaded = null;
	}

	if(window.sf$proxy)
		window.sf$proxy.sfLoaderTrigger = waitResources;
}
const IE11 = Object.getOwnPropertyDescriptor(Function.prototype, 'length').configurable === false;

sf.dom = function(selector, context){
	if(!selector){
		if(selector === void 0){
			const temp = sel=> temp.find(sel);

			if(IE11)
				Object.defineProperty(temp, '_', {value:true});
			return Object.setPrototypeOf(temp, DOMList.prototype);
		}
		else return _DOMList([]);
	}
	else if(selector.constructor === Function)
		return sf.loader.onFinish(selector);
	else if(selector[0] === '<' || selector[selector.length-1] === '>')
		return _DOMList($.parseElement(selector, true));
	else if(context){
		if(context.classList === void 0){
			if(context.animateKey === $.fn.animateKey)
				return context.find(selector);
			else
				return $(queryElements(context, selector));
		}
		return _DOMList(context.querySelectorAll(selector));
	}
	else if(selector.constructor === String)
		return _DOMList(document.querySelectorAll(selector));
	return _DOMList(selector);
}

var $ = sf.dom; // Shortcut

const css_str = /\-([a-z0-9])/;
const css_strRep = (f, m)=> m.toUpperCase();
class DOMList{
	constructor(elements){
		if(elements === null){
	    	this.length = 0;
			return this;
		}

		if(elements.length === void 0){
			this[0] = elements;
			this.length = 1;
			return this;
		}

	    for (let i = 0; i < elements.length; i++)
	    	this[i] = elements[i];

		this.length = elements.length;
		return this;
	}
	push(el){
		if(this._){
			const news = recreateDOMList(this, this.length+1);
			news[this.length] = el;

			return news;
		}

		if(this._s === void 0){
			Object.defineProperties(this, {
				length:{writable:true, enumerable:false, value:1},
				_s:{enumerable:false, value:true},
			});

			this[0] = el;
			return this;
		}

		this[this.length++] = el;
		return this;
	}
	splice(i, count){
		if(i < 0)
			i = this.length + i;

		if(count === void 0)
			count = this.length - i;

		for (var n = this.length - count; i < n; i++)
			this[i] = this[i + count];

		if(this._ === true)
			return recreateDOMList(this, this.length - count);

		if(this._s === void 0){
			Object.defineProperties(this, {
				length:{writable:true, enumerable:false, value:this.length},
				_s:{enumerable:false, value:true},
			});
		}

		this.length -= count;
		for (var i = this.length, n = this.length + count; i < n; i++)
			delete this[i];

		return this;
	}
	find(selector){
		if(this.length === 1) // Optimize perf ~66%
			return _DOMList(this[0].querySelectorAll(selector));

		const t = [];
		for (let i = 0; i < this.length; i++)
			t.push.apply(t, this[i].querySelectorAll(selector));
		return _DOMList(t);
	}
	parent(selector){
		if(this.length === 1){
			if(selector)
				return _DOMList(this[0].closest(selector));
			return _DOMList(this[0].parentNode);
		}

		const t = [];
		for (let i = 0; i < this.length; i++)
			t.push.apply(t, this[i].closest(selector));
		return _DOMList(t);
	}
	prev(selector){
		let t;
		if(this.length !== 0)
			t = $.prevAll(this[0], selector, false, true);
		return _DOMList(t || []);
	}
	prevAll(selector){
		const t = [];
		for (let i = 0; i < this.length; i++)
			t.push.apply(t, $.prevAll(this[i], selector));
		return _DOMList(t);
	}
	next(selector){
		let t;
		if(this.length !== 0)
			t = $.prevAll(this[0], selector, true, true);
		return _DOMList(t || []);
	}
	nextAll(selector){
		const t = [];
		for (let i = 0; i < this.length; i++)
			t.push.apply(t, $.prevAll(this[i], selector, true));
		return _DOMList(t);
	}
	children(selector){
		const t = [];

		for (let a = 0; a < this.length; a++) {
			const child = this[a].children;

			for (let i = 0; i < child.length; i++){
				if(child[i].matches(selector))
					t.push(child[i]);
			}
		}
		return _DOMList(t);
	}

	// Action only
	remove(){
		for (let i = 0; i < this.length; i++)
			this[i].remove();
		return this;
	}
	empty(){
		for (let i = 0; i < this.length; i++)
			this[i].textContent = '';
		return this;
	}
	addClass(name){
		for (let i = 0; i < this.length; i++)
			DOMTokenList.prototype.add.apply(this[i].classList, name.split(' '));
		return this;
	}
	removeClass(name){
		for (let i = 0; i < this.length; i++)
			DOMTokenList.prototype.remove.apply(this[i].classList, name.split(' '));
		return this;
	}
	toggleClass(name){
		for (let i = 0; i < this.length; i++)
			DOMTokenList.prototype.toggle.apply(this[i].classList, name.split(' '));
		return this;
	}
	hasClass(name){
		for (let i = 0; i < this.length; i++)
			if(this[i].classList.contains(name))
				return true;
		return false;
	}
	prop(name, value){
		if(value === void 0)
			return this.length !== 0 ? this[0][name] : '';

		for (let i = 0; i < this.length; i++)
			this[i][name] = value;

		return this;
	}
	attr(name, value){
		if(value === void 0)
			return this.length !== 0 ? this[0].getAttribute(name) : '';

		for (let i = 0; i < this.length; i++)
			this[i].setAttribute(name, value);

		return this;
	}
	removeAttr(name){
		for (let i = 0; i < this.length; i++)
			this[i].removeAttribute(name);

		return this;
	}
	css(name, value){
		if(value === void 0 && name.constructor === String)
			return this.length !== 0 ? this[0].style[name] : '';

		if(name.constructor === Object){
			for(let key in name){
				if(key.includes('-') === false)
					continue;

				name[key.replace(css_str, css_strRep)] = name[key];
				delete name[key];
			}

			for (var i = 0; i < this.length; i++)
				Object.assign(this[i].style, name);

			return this;
		}

		name = name.replace(css_str, css_strRep);

		for (var i = 0; i < this.length; i++)
			this[i].style[name] = value;

		return this;
	}
	on(event, selector, callback, options){
		for (let i = 0; i < this.length; i++){
			if(internal.model.specialEvent[event] !== void 0){
				internal.model.specialEvent[event](this[i], null, callback);
				continue;
			}

			$.on(this[i], event, selector, callback, options);
		}

		return this;
	}
	off(event, selector, callback, options){
		for (let i = 0; i < this.length; i++){
			if(event === void 0){
				$.off(this[i]);
				continue;
			}

			if(internal.model.specialEvent[event] !== void 0){
				if(this[i][`sf$eventDestroy_${event}`] !== void 0)
					this[i][`sf$eventDestroy_${event}`]();

				continue;
			}

			$.off(this[i], event, selector, callback, options);
		}
		return this;
	}
	once(event, selector, callback){
		for (let i = 0; i < this.length; i++)
			$.once(this[i], event, selector, callback);
		return this;
	}
	trigger(events, data, direct) {
		events = events.split(' ');
		for (let i = 0; i < events.length; i++) {
			const event = events[i];
			for (let j = 0; j < this.length; j++) {
				if(direct === true){
					this[j][event](data);
					continue;
				}

				let evt;
				try {
					evt = new window.CustomEvent(event, {detail: data, bubbles: true, cancelable: true});
				} catch (e) {
					evt = document.createEvent('Event');
					evt.initEvent(event, true, true);
					evt.detail = data;
				}

				this[j].dispatchEvent(evt);
			}
		}
		return this;
	}
	animateKey(name, callback, duration){
		for (let i = 0; i < this.length; i++)
			$.animateKey(this[i], name, callback, duration);
		return this;
	}
	each(callback){
		for (let i = 0; i < this.length; i++)
			callback.call(this[i], i, this);
		return this;
	}
	data(key, value){
		if(value === void 0)
			return this.length !== 0 && this[0].$data ? this[0].$data[key] : void 0;

		for (let i = 0; i < this.length; i++){
			if(this[i].$data === void 0)
				this[i].$data = {};
			this[i].$data[key] = value;
		}
		return this;
	}
	removeData(key){
		for (let i = 0; i < this.length; i++){
			if(this[i].$data === void 0)
				continue;

			delete this[i].$data[key];
		}
		return this;
	}
	append(element){
		if(element.constructor === Array){
			for (let i = 0; i < element.length; i++)
				this[0].append(element[i]);
		}
		else{
			if(element.constructor === String)
				this[0].insertAdjacentHTML('beforeEnd', element);
			else this[0].append(element);
		}
		return this;
	}
	prepend(element){
		if(element.constructor === Array){
			for (let i = 0; i < element.length; i++)
				this[0].prepend(element[i]);
		}
		else{
			if(element.constructor === String)
				this[0].insertAdjacentHTML('afterBegin', element);
			else this[0].prepend(element);
		}
		return this;
	}
	eq(i, count){
		if(i < 0)
			i = this.length + i;

		if(count === void 0)
			return _DOMList(this[i]);

		return _DOMList(this.slice(i, count > 0 ? count : void 0));
	}
	insertAfter(el){
		const parent = el.parentNode;
		const next = el.nextSibling;
		parent.insertBefore(this[0], next);

		// Sometime it could gone
		if(this[0] === void 0){
			const temp = toArray(this);
			temp[0] = el.previousSibling;

			for (var i = 1; i < temp.length; i++)
				parent.insertBefore(temp[i], next);

			return $(temp);
		}

		if(this.length > 1)
			for (var i = 1; i < this.length; i++)
				parent.insertBefore(this[i], this[i-1]);
		return this;
	}
	insertBefore(el){
		const parent = el.parentNode;
		parent.insertBefore(this[0], el);

		// Sometime it could gone
		if(this[0] === void 0){
			const temp = toArray(this);
			temp[0] = el.nextSibling;

			for (var i = 1; i < temp.length; i++)
				parent.insertBefore(temp[i], el);

			return $(temp);
		}

		if(this.length > 1)
			for (var i = 1; i < this.length; i++)
				parent.insertBefore(this[i], el);
		return this;
	}

	text(text){
		if(text === void 0)
			return this.length !== 0 ? this[0].textContent : '';

		for (let i = 0; i < this.length; i++)
			this[i].textContent = text;
		return this;
	}
	html(text){
		if(text === void 0)
			return this.length !== 0 ? this[0].innerHTML : '';

		for (let i = 0; i < this.length; i++)
			this[i].innerHTML = text;
		return this;
	}
	val(text){
		if(text === void 0)
			return this.length !== 0 ? this[0].value : '';

		for (let i = 0; i < this.length; i++)
			this[i].text = text;
		return this;
	}

	// Event trigger shortcut
	click(d){return this.trigger('click', d, true)}
	blur(d){return this.trigger('blur', d, true)}
	focus(d){return this.trigger('focus', d, true)}
	focusin(d){return this.trigger('focusin', d)}
	focusout(d){return this.trigger('focusout', d)}
	keyup(d){return this.trigger('keyup', d)}
	keydown(d){return this.trigger('keydown', d)}
	keypress(d){return this.trigger('keypress', d)}
	submit(d){return this.trigger('submit', d)}
	change(d){return this.trigger('change', d)}
	mousedown(d){return this.trigger('mousedown', d)}
	mousemove(d){return this.trigger('mousemove', d)}
	mouseup(d){return this.trigger('mouseup', d)}
	mouseenter(d){return this.trigger('mouseenter', d)}
	mouseleave(d){return this.trigger('mouseleave', d)}
	mouseout(d){return this.trigger('mouseout', d)}
	mouseover(d){return this.trigger('mouseover', d)}
	touchstart(d){return this.trigger('touchstart', d)}
	touchend(d){return this.trigger('touchend', d)}
	touchmove(d){return this.trigger('touchmove', d)}
	resize(d){return this.trigger('resize', d, true)}
	scroll(d){return this.trigger('scroll', d, true)}
}

function _DOMList(list){
	if(!list || list.forEach === void 0 || list.constructor !== NodeList)
		return new DOMList(list);

	const { length } = list;
	Object.setPrototypeOf(list, DOMList.prototype);
	list.length = length;
	return list;
}

function queryElements(arr, selector){
	const list = [];
	for (let i = 0; i < arr.length; i++)
		list.push.apply(list, arr[i].querySelectorAll(selector));
	return list;
}

// Fix for IE11 and Safari, due to lack of writable length
function recreateDOMList($el, length){
	const args = ['sel'];
	for (var i = 1; i < length; i++)
		args.push(`a${i}`);

	const obj = {};
	const temp = Function('o', `return function(${args.join(',')}){return o.find(sel)}`)(obj);
	for (var i = 0; i < length; i++)
		temp[i] = $el[i];

	obj.find = sel=> temp.find(sel);

	Object.defineProperty(temp, '_', {value:true});
	return Object.setPrototypeOf(temp, DOMList.prototype);
}

;(function(){
	const self = sf.dom;

	// ToDo: Optimize performance by using `length` check instead of `for` loop
	self.fn = DOMList.prototype;
	self.fn.add = self.fn.push;

	// Bring array feature that not modifying current length
	self.fn.indexOf = Array.prototype.indexOf;
	self.fn.forEach = Array.prototype.forEach;
	self.fn.concat = Array.prototype.concat;
	self.fn.reverse = Array.prototype.reverse;
	self.fn.slice = Array.prototype.slice;
	self.fn.filter = Array.prototype.filter;
	self.fn.includes = Array.prototype.includes;

	self.findOne = function(selector, context){
		if(context !== void 0) return context.querySelector(selector);
		return document.querySelector(selector);
	}

	self.isChildOf = function(child, parent) {
	     let node = child.parentNode;
	     while (node !== null) {
	         if(node === parent)
	             return true;

	         node = node.parentNode;
	     }

	     return false;
	}

	self.parentHasProperty = function(element, propertyName){
		do {
			if(element[propertyName] !== void 0)
				return element;

			element = element.parentNode;
		} while (element !== null);
		return null;
	}

	self.prevAll = function(element, selector, isNext, one){
		const result = [];
		const findNodes = (!selector || selector.constructor !== String) ? true : false;

		// Skip current element
		element = isNext ? element.nextSibling : element.previousSibling;
		while (element !== null) {
			if(findNodes === false){
				if(element.matches(selector) === true){
					if(one)
						return element;
					result.push(element);
				}
			}
			else{
				if(element === selector){
					if(one)
						return true;
					break;
				}
				result.push(element);
			}

			if(isNext)
				element = element.nextSibling;
			else
				element = element.previousSibling;
		}

		if(one)
			return;
		return result;
	}

	// Shorcut
	self.nextAll = (element, selector, one)=> self.prevAll(element, selector, true, one)

	/**
	 * Listen to an event
	 * @param  Node 			element 	parent element
	 * @param  string 			event   	event name
	 * @param  function|string  selector    callback function or selector
	 * @param  function			callback    callback function
	 * @param  object			options     event options
	 * @return null
	 */
	self.on = function(element, event, selector, callback, options){
		if(event.includes(' ')){
			event = event.split(' ');
			for (let i = 0; i < event.length; i++) {
				self.on(element, event[i], selector, callback, options);
			}
			return;
		}

		if(callback !== void 0 && callback.constructor === Object){
			const temp = options;
			options = callback;
			callback = temp;
		}

		if(selector.constructor === Function){
			callback = selector;
			selector = null;
		}

		else if(selector.constructor === Object){
			options = selector;
			selector = null;
		}

		if(selector){
			// Check the related callback from `$0.sf$eventListener[event][index].callback`

			const tempCallback = callback;
			callback = function(ev){
				const target = ev.target.closest(selector);
				if(target !== null)
					tempCallback.call(target, ev);
			}
			callback.callback = tempCallback;
		}

		callback.selector = selector;
		callback.options = options;

		if(element === sf.window){
			if(windowEv[event] === void 0)
				windowEv[event] = [];

			// Listen on current window
			window.addEventListener(event, callback, callback.options);
			saveEvent(window, event, callback);

			// Also listen for other window
			windowEv[event].push(callback);
			const winList = sf.window.list;
			for(let key in winList){
				winList[key].addEventListener(event, callback, callback.options);
				saveEvent(winList[key], event, callback);
			}

			return;
		}

		element.addEventListener(event, callback, callback.options);
		if(typeof options === 'object' && options.once)
			return;

		saveEvent(element, event, callback);
	}

	function saveEvent(element, event, callback){
		// Save event listener
		if(element.sf$eventListener === void 0)
			element.sf$eventListener = {};

		if(element.sf$eventListener[event] === void 0)
			element.sf$eventListener[event] = [];

		element.sf$eventListener[event].push(callback);
	}

	// Shorcut
	self.once = function(element, event, selector, callback){
		self.on(element, event, selector, callback, {once:true});
	}

	/**
	 * Remove event listener
	 * @param  Node 	element 	parent element
	 * @param  string 	event   	event name
	 * @param  string  	selector    selector | callback
	 * @param  function  	callback    callback
	 * @return null
	 */
	self.off = function(element, event, selector, callback, options){
		// Remove all event
		if(event === void 0){
			if(element.sf$eventListener === void 0)
				return;

			for(var events in element.sf$eventListener) {
				self.off(element, events);
			}
			return;
		}

		var events = event.split(' ');
		if(events.length !== 1){
			for (var i = 0; i < events.length; i++) {
				self.off(element, events[i]);
			}
			return;
		}

		if(selector !== void 0 && selector.constructor === Function){
			callback = selector;
			selector = void 0;
		}

		if(element === sf.window){
			if(windowEv[event] === void 0 || windowEv[event].length === 0)
				return;

			const list = windowEv[event];
			if(callback){
				var i = list.indexOf(callback);
				if(i !== -1)
					list.splice(i, 1);
			}
			else list.length = 0;

			// Remove from current window
			removeEvent(window, event, selector, callback, options);

			// Remove from other window
			const winList = sf.window.list;
			for(let key in winList)
				removeEvent(winList[key], event, selector, callback, options);

			return;
		}

		removeEvent(element, event, selector, callback, options);
	}

	function removeEvent(element, event, selector, callback, options){
		// Remove listener
		if(element.sf$eventListener === void 0){
			if(callback !== void 0)
				element.removeEventListener(event, callback, options);

			return;
		}

		if(callback){
			element.removeEventListener(event, callback, options);
			var ref = element.sf$eventListener[event];
			if(ref === void 0)
				return;

			var i = ref.indexOf(callback);

			if(i !== -1)
				ref.splice(i, 1);

			if(ref.length === 0)
				delete element.sf$eventListener[event];
		}
		else{
			var ref = element.sf$eventListener;
			if(ref !== void 0 && ref[event] !== void 0){
				const ref2 = ref[event];
				for (var i = ref2.length - 1; i >= 0; i--) {
					if(selector && ref2[i].selector !== selector)
						continue;

					var { options } = ref2[i];
					element.removeEventListener(event, ref2.splice(i, 1)[0], options);
				}

				delete element.sf$eventListener[event];
			}
		}
	}

	self.animateKey = function(element, animationName, duration, callback){
		if(element === void 0)
			return;

		if(duration && duration.constructor === Function){
			callback = duration;
			duration = void 0;
		}

		if(duration === void 0 || duration.constructor === Number)
			duration = {
				duration:duration && duration.constructor === Number ? duration : 0.6,
				ease:'ease',
				fill:'both'
			};

		if(duration.skipOnHidden && (
			element.offsetParent === null || window.getComputedStyle(element).visibility === 'hidden'
		)) return;

		let animationEnd = null;

		if(element.style.animation !== void 0)
			animationEnd = 'animationend';

		if(element.style.WebkitAnimation !== void 0)
			animationEnd = 'webkitAnimationEnd';

	  	const { style } = element;
		let arrange = animationName;

		if(duration.duration !== void 0)
			arrange += ` ${duration.duration}s`;
		if(duration.ease !== void 0)
			arrange += ` ${duration.ease}`;

		if(duration.delay !== void 0){
			arrange += ` ${duration.delay}s`;

			if(animationEnd === 'animationend')
				var animationStart = 'animationstart';
			else var animationStart = 'webkitAnimationStart';

			if(duration.visible === false){
				element.classList.add('anim-pending');
				style.visibility = 'hidden';
			}

			self.once(element, animationStart, function(){
				if(element.isConnected === false)
					return;

				if(duration.whenBegin)
					duration.whenBegin.call(element);

				element.classList.remove('anim-pending');
				style.visibility = 'visible';
			});
		}
		else style.visibility = 'visible';

		if(duration.iteration !== void 0)
			arrange += ` ${duration.iteration}`;
		if(duration.direction !== void 0)
			arrange += ` ${duration.direction}`;
		if(duration.fill !== void 0)
			arrange += ` ${duration.fill}`;

		style.webkitAnimation = style.animation = arrange;

		setTimeout(function(){
			if(element.isConnected === void 0){
				if(callback !== void 0) callback.call(element);
				return;
			}

			element.classList.add('anim-element');

			if(element.parentNode !== null){
				const origin = (element.offsetLeft + element.offsetWidth/2)+'px' + (element.offsetTop + element.offsetHeight/2)+'px';
				const parentStyle = element.parentNode.style;
				element.parentNode.classList.add('anim-parent');
				parentStyle.webkitPerspectiveOrigin = parentStyle.perspectiveOrigin = origin;
			}

			self.once(element, animationEnd, function(){
				setTimeout(function(){
					if(element.parentNode !== null){
						style.visibility = '';
						element.classList.remove('anim-element');
						style.webkitAnimation = style.animation = '';

						const parentStyle = element.parentNode.style;
						parentStyle.webkitPerspectiveOrigin = parentStyle.perspectiveOrigin = '';

						if(callback !== void 0) callback.call(element);
					}
				});
			});
		});
	}

	const emptyDOM = document.createElement('div');
	self.parseElement = function(html, elementOnly){
		emptyDOM.innerHTML = `<template>${html}</template>`;

		if(elementOnly)
			return emptyDOM.firstElementChild.content.children || [];
		return emptyDOM.firstElementChild.content.childNodes || [];
	}

	self.escapeText = function(text){
		const tempDOM = emptyDOM;
		tempDOM.textContent = text;
		return tempDOM.innerHTML;
	}

	self.remove = function(elements){
		if(elements.remove !== void 0)
			return elements.remove();

		for (let i = 0; i < elements.length; i++) {
			elements[i].remove();
		}
	}

	let documentElement = null;
	sf.loader.domReady(function(){
		documentElement = document.body.parentNode;
	});

	const haveSymbol = /[~`!@#$%^&*()+={}|[\]\\:";'<>?,./ ]/;
	self.getSelector = function(element, childIndexes, untilElement){
		if(untilElement === void 0) untilElement = documentElement;
		else if(element === untilElement){
			if(childIndexes)
				return [];
			return '';
		}

		const previousSibling = childIndexes ? 'previousSibling' : 'previousElementSibling';

		const names = [];
		while(element.parentElement !== null){
			if(!childIndexes && element.id && !haveSymbol.test(element.id)){
				names.unshift(`#${element.id}`);
				break;
			}
			else{
				if(element === untilElement)
					break;
				else {
					let e = element;
					let i = childIndexes ? 0 : 1;

					while(e[previousSibling]){
						e = e[previousSibling];
						i++;
					}

					if(childIndexes)
						names.unshift(i);
					else
						names.unshift(`:nth-child(${i})`);
				}

				element = element.parentElement;
				if(element === null)
					break;
			}
		}

		if(childIndexes)
			return names;
		return names.join(" > ");
	}

	self.childIndexes = function(array, context){
		if(array.length === 0) // 2ms
			return context;

		let element = context || documentElement;

		if(array[0].constructor === String && element.id !== array[0].substr(1)) // 3.9ms
			element = element.querySelector(array[0]);

		for (let i = 0; i < array.length; i++) { // 36ms
			element = array[i] === 0
				? element.firstChild
				: element.childNodes.item(array[i]); // 37ms

			if(element === null)
				return null;
		}

		return element;
	}

})();
// ToDo: component list on registrar[2] still using same reference

sf.space = (namespace, options)=> new Space(namespace, options);

// { name:{ default:{}, id:{}, ... } }
sf.space.list = {};
function getNamespace(name, id){
	let scope = sf.space.list[name];
	if(scope === void 0)
		scope = sf.space.list[name] = {};

	if(scope[id] === void 0){
		let ref = scope.default;
		if(ref === void 0){
			ref = scope.default = createRoot_({}, {});

			if(id === 'default')
				return ref;
		}

		scope[id] = createRoot_(ref.modelFunc, ref.registered);
	}

	return scope[id];
}

function createRoot_(modelFunc, registered){
	const root_ = function(scope){
		let temp = root_.registered[scope];
		if(temp) return temp[2];

		temp = root_.root;
		if(temp[scope] === void 0){
			temp[scope] = {};

			if(modelFunc[scope].constructor !== Function)
				console.warn(scope, "haven't been registered. Please check your compiler settings or the compiled file");
			else modelFunc[scope](temp[scope], root_);
		}

		return temp[scope];
	};

	root_.root = {};
	root_.modelFunc = modelFunc;
	root_.registered = registered;
	const domList = root_.domList = [];

	return root_;
}

if(window.sf$proxy)
	internal.space = window.sf$proxy.internalSpace;
else
	internal.space = {
		empty:true,
		initComponent(root, tagName, elem, $item, asScope){
			sf.component.new(tagName, elem, $item, root.constructor === Function ? root : root.sf$space, asScope);
		},
		initModel(root, elem){
			const name = elem.getAttribute('name');

			// Pending if model handler was not loaded
			if(root.sf$space.modelFunc[name] === void 0)
				return root.sf$space.modelFunc[name] = [[elem, name, root.sf$space]];

			if(root.sf$space.modelFunc[name].constructor === Array)
				return root.sf$space.modelFunc[name].push([elem, name, root.sf$space]);

			sf.model.init(elem, name, root.sf$space);
		},
	};

if(window.sf$proxy === void 0)
	forProxying.internalSpace = internal.space;

class Space{
	constructor(namespace, options){
		if(namespace === void 0)
			throw new Error('`namespace` parameter need to be specified');

		if(namespace !== namespace.toLowerCase())
			throw new Error('`namespace` must be lowercase');

		this.namespace = namespace;
		this.default = getNamespace(namespace, 'default');

		this.list = sf.space.list[namespace];

		if(options)
			this.templatePath = options.templatePath;
	}

	getScope(index){
		return getNamespace(this.namespace, index || 'default');
	}

	createHTML(index){
		const that = this;
		return $(window.templates[this.templatePath]
			.replace(/<sf-space(.*?)(?:|="(.*?)")>/, function(full, namespace, index_){
				if(index_ && isNaN(index_) === false)
					index_ = Number(index_) + 1;

				index = index || index_ || false;
				if(index)
					index = `="${index}"`;

				return `<sf-space ${that.namespace}>`;
			}))[0];
	}

	destroy(){

	}
}

;(function(){
	const self = Space.prototype;
	self.model = function(name, options, func){
		if(options !== void 0){
			if(options.constructor === Function)
				func = options;
			else{
				internal.modelInherit[name] = options.extend;
			}

			const old = this.default.modelFunc[name];
			this.default.modelFunc[name] = func;

			if(old !== void 0 && old.constructor === Array)
				for (let i = 0; i < old.length; i++){
					const arg = old[i];
					sf.model.init(arg[0], arg[1], arg[2]);
				}

			return;
		}

		sf.model(name, options, func, this.default);
	}

	self.component = function(name, options, func){
		return sf.component(name, options, func, this.default);
	}

	self.destroy = function(){
		for(var keys in this.root){
			if(keys.indexOf(namespace) === 0){
				this.root[keys].$el.remove();
				delete this.root[keys];
			}
		}

		for(var keys in this.components.registered){
			if(keys.indexOf(namespace) === 0)
				delete this.components.registered[keys];
		}

		for(var keys in internal.component){
			if(keys.indexOf(namespace) === 0)
				delete internal.component[keys];
		}
	}
})();

// Define sf-model element
class SFSpace extends HTMLElement {
	constructor(){
		super();
		this.sf$firstInit = true;
	}
	connectedCallback(){
		if(this.sf$destroying !== void 0){
			delete this.sf$destroying;
			clearTimeout(this.sf$destroying);
		}

		if(this.sf$firstInit === void 0)
			return;

		delete this.sf$firstInit;
		forProxying.internalSpaceEmpty = internal.space.empty = false;

		// Extract namespace name
		for(let i=0, n=this.attributes.length; i < n; i++){
			var { name } = this.attributes[i]
			if(name === 'class' || name === 'style' || name === 'id')
				continue;

			this.sf$spaceName = name;
			this.sf$spaceID = this.attributes[i].value || 'default';
			break;
		}

		if(this.sf$spaceName === void 0)
			throw new Error("<sf-space>: space name was undefined");

		this.sf$space = getNamespace(name, this.sf$spaceID);
		this.sf$space.domList.push(this);
	}
	disconnectedCallback(){
		const that = this;
		const destroy = function(){
			const i = that.sf$space.domList.indexOf(that);
			if(i !== -1)
				that.sf$space.domList.splice(i, 1);
		}

		if(window.destroying)
			return destroy();

		this.sf$destroying = setTimeout(destroy, 1000);
	}
}

customElements.define('sf-space', SFSpace);
// Data save and HTML content binding
sf.model = function(name, options, func, namespace){
	if(options !== void 0)
		return sf.model.for(name, options, func);

	// If it's component tag
	if((namespace || sf.component).registered[name] !== void 0)
		return (namespace || root_)(name);

	const scope = namespace || sf.model;
	if(scope.root[name] === void 0){
		if(internal.modelInherit[name] !== void 0)
			scope.root[name] = new internal.modelInherit[name]();
		else
			scope.root[name] = {};
	}

	return scope.root[name];
};

function findBindListElement(el){
	el = el.parentNode;
	while(el !== null){
		if(el.sf$elementReferences && el.sf$elementReferences.template.bindList)
			return el;

		el = el.parentNode;
	}
	return null;
}

;(function(){
	const self = sf.model;
	self.root = {};
	internal.modelPending = {};
	internal.modelInherit = {};

	// Find an index for the element on the list
	self.index = function(element){
		if(!element.sf$elementReferences || !element.sf$elementReferences.template.bindList)
			element = findBindListElement(element);

		if(element === null)
			return -1;

		let i = -1;
		const tagName = element.tagName;
		const currentElement = element;

		while(element !== null) {
			if(element.tagName === tagName)
				i++;
			else if(element.nodeType !== 8) break;

			element = element.previousSibling;
		}

		const ref = currentElement.sf$elementReferences && currentElement.sf$elementReferences.template.bindList;

		const VSM = currentElement.parentNode.$VSM;
		if(VSM !== void 0) return i + VSM.firstCursor;
		return i;
	}

	// Declare model for the name with a function
	self.for = function(name, options, func, namespace){
		if(options.constructor === Function){
			func = options;

			// It's a class
			if(func.prototype.init !== void 0){
				internal.modelInherit[name] = func;
				func = {class:func};
			}
		}
		else internal.modelInherit[name] = options.extend;

		const scope = namespace || self;

		let scopeTemp;
		if(hotReload)
			hotModel(scope, name, func);
		else{
			scopeTemp = scope(name);

			// Call it it's a function
			if(func.constructor === Function)
				func(scopeTemp, scope);
		}

		if(sf.loader.DOMWasLoaded && internal.modelPending[name] !== void 0){
			const temp = internal.modelPending[name];
			for (let i = 0; i < temp.length; i++) {
				sf.model.init(temp[i], temp[i].getAttribute('name'));
			}

			delete internal.modelPending[name];
		}

		// Return model scope
		return scopeTemp || scope(name);
	}

	// Get property of the model
	self.modelKeys = function(modelRef, toString){
		// it maybe custom class
		if(modelRef.constructor !== Object && modelRef.constructor !== Array){
			var keys = new Set();
			for(var key in modelRef){
				if(key.includes('$'))
					continue;

				keys.add(key);
			}

			getStaticMethods(keys, modelRef.constructor);
			getPrototypeMethods(keys, modelRef.constructor);

			if(toString){
				let temp = '';
				for(var key of keys){
					if(temp.length === 0){
						temp += key;
						continue;
					}

					temp += `|${key}`;
				}

				return temp;
			}

			return Array.from(keys);
		}

		var keys = [];
		for(var key in modelRef){
			if(key.includes('$'))
				continue;

			keys.push(key);
		}

		if(toString)
			return keys.join('|');

		return keys;
	}
})();

// Define sf-model element
class SFModel extends HTMLElement {
	constructor(){
		super();

		this.sf$firstInit = true;
	}
	connectedCallback(){
		if(this.sf$destroying !== void 0){
			delete this.sf$destroying;
			clearTimeout(this.sf$destroying);
		}

		if(this.sf$firstInit === void 0)
			return;

		delete this.sf$firstInit;
		if(internal.space.empty === false){
			const haveSpace = this.closest('sf-space');
			if(haveSpace !== null){
				internal.space.initModel(haveSpace, this);
				return;
			}
		}

		const name = this.getAttribute('name');

		// Instant run when model scope was found or have loaded
		if(sf.model.root[name] !== void 0 && internal.modelPending[name] === void 0){
			// Run init when all assets have loaded
			if(sf.loader.DOMWasLoaded){
				internal.language.refreshLang(this);
				return sf.model.init(this, name);
			}

			const that = this;
			sf.loader.onFinish(function(){
				internal.language.refreshLang(that);
				sf.model.init(that, name);
			});
			return;
		}

		// Pending model initialization
		if(internal.modelPending[name] === void 0)
			internal.modelPending[name] = [];

		internal.modelPending[name].push(this);
	}
	disconnectedCallback(){
		const that = this;
		const destroy = function(){
			if(that.model === void 0)
				return;

			if(that.model.$el){
				const i = that.model.$el.indexOf(that);
				if(i !== -1){
					var model = that.model;
					const temp = model.$el[i];

					model.$el = model.$el.splice(i, 1);
					model.destroy && model.destroy(temp, model.$el.length === 0);
				}
			}

			internal.model.removeModelBinding(that.model);
		};

		if(window.destroying)
			return destroy();

		this.sf$destroying = setTimeout(destroy, 1000);
	}
}

customElements.define('sf-m', SFModel);

var root_ = function(scope){
	if(sf.component.registered[scope])
		return sf.component(scope);

	if(sf.model.root[scope] === void 0) {
		const scope_ = {};
		sf.model.root[scope] = {};
	}

	return sf.model.root[scope];
}

sf.component = function(name, options, func, namespace){
	if(options !== void 0){
		if(options.constructor === Function)
			func = options;

		if(func !== options)
			sf.component.html(name, options, namespace);

		if(func !== void 0 && func.constructor === Function)
			return sf.component.for(name, options, func, namespace);
	}

	const temp = sf.component.registered[name];
	return temp ? temp[2] : [];
}

function prepareComponentTemplate(temp, tempDOM, name, newObj, registrar){
	tempDOM = temp.tempDOM || temp.tagName.toLowerCase() === name;

	const isDynamic = internal.model.templateInjector(temp, newObj, true);
	temp = sf.model.extractPreprocess(temp, null, newObj, void 0, registrar[4]);

	if(isDynamic === false)
		registrar[3] = temp;

	// We need to improve sf-reserved to reduce re-extraction
	else{
		isDynamic.tempDOM = tempDOM;
		registrar[3] = isDynamic;
	}

	temp.tempDOM = tempDOM;
	return temp;
}

;(function(){
	const self = sf.component;
	internal.component = {};
	internal.componentInherit = {};

	const waitingHTML = {};

	self.registered = {};
	// internal.component.tagName = new Set();

	function checkWaiting(name, namespace){
		const scope = namespace || self;

		const upgrade = waitingHTML[name];
		for (let i = upgrade.length - 1; i >= 0; i--) {
			if(upgrade[i].namespace !== namespace)
				continue;

			let { el } = upgrade[i];
			el = self.new(name, el, upgrade[i].item, namespace, false, true);
			if(el === void 0)
				return;

			el.connectedCallback('init');
			upgrade.pop();
		}

		if(upgrade.length === 0)
			delete waitingHTML[name];
	}

	self.for = function(name, options, func, namespace){
		if(options.constructor === Function){
			func = options;

			// It's a class
			if(func.prototype.init !== void 0){
				internal.componentInherit[name] = func;
				func = {class:func};
			}
		}
		else{
			if(options.extend !== void 0)
				internal.componentInherit[name] = options.extend;
		}

		// internal.component.tagName.add(name.toUpperCase());
		const scope = namespace || self;

		// 0=Function for scope, 1=DOM Contructor, 2=elements, 3=Template
		let registrar = scope.registered[name];
		if(registrar === void 0){
			registrar = scope.registered[name] = new Array(5);
			registrar[2] = [];
			// index 1 is $ComponentConstructor
		}

		registrar[0] = func;

		const construct = defineComponent(name);
		registrar[1] = construct;
		window[`$${capitalizeLetters(name.split('-'))}`] = construct;

		if(waitingHTML[name] !== void 0)
			checkWaiting(name, namespace);
		else if(hotReload)
			hotComponentRefresh(scope, name, func);

		// Return list of created component
		return registrar[2];
	}

	self.html = function(name, outerHTML, namespace){
		const scope = namespace || self;
		let templatePath = false;

		if(outerHTML.constructor === Object){
			let template;

			if(outerHTML.template){
				templatePath = outerHTML.template;
				if(window.templates){
					if(window.templates[outerHTML.template] !== void 0){
						template = window.templates[outerHTML.template];

						if(hotReload && proxyTemplate[outerHTML.template] === void 0)
							proxyTemplate[outerHTML.template] = [scope, name];

						if(!outerHTML.keepTemplate && hotReload === false)
							delete window.templates[outerHTML.template];
					}
					else{
						TemplatePending.push(function(){
							self.html(name, outerHTML, namespace, true);
						});
						return console.warn(`Waiting template path '${outerHTML.template}' to be loaded`);
					}
				}
			}
			else if(outerHTML.html)
				template = outerHTML.html;
			else return;

			if(template === void 0){
				TemplatePending.push(function(){
					self.html(name, outerHTML, namespace, true);
				});
				return console.warn(`Waiting template for '${name}' to be loaded`);
			}

			outerHTML = template;
		}

		// 0=Function for scope, 1=DOM Contructor, 2=elements, 3=Template, 4=ModelRegex
		let registrar = scope.registered[name];
		if(registrar === void 0){
			registrar = scope.registered[name] = new Array(5);
			registrar[2] = [];
		}

		let temp;
		if(outerHTML.constructor === String)
			temp = $.parseElement(outerHTML);
		else temp = outerHTML;

		if(temp.length === 1)
			registrar[3] = temp[0];
		else{
			const tempDOM = document.createElement('div');
			tempDOM.tempDOM = true;
			for (let i = temp.length - 1; i >= 0; i--) {
				tempDOM.insertBefore(temp[i], tempDOM.firstChild);
			}
			registrar[3] = tempDOM;
		}

		if(templatePath !== false){
			templatePath = templatePath.split('/');
			templatePath.pop();
			templatePath = templatePath.join('/');
			if(templatePath !== '')
				templatePath += '/';

			registrar[3].templatePath = templatePath;
		}

		if(waitingHTML[name] !== void 0)
			checkWaiting(name, namespace);

		if(hotReload){
			if(templatePath === false)
				hotComponentTemplate(scope, name);
			else if(backupCompTempl.has(registrar) === false)
				backupCompTempl.set(registrar, registrar[3]);
		}
	}

	const tempDOM = document.createElement('div');
	self.new = function(name, element, $item, namespace, asScope, _fromCheck){
		if(internal.component.skip)
			return;

		if(element.sf$componentIgnore === true)
			return;

		if(element.hasAttribute('sf-repeat-this')){
			element.sf$componentIgnore = true;
			return;
		}

		const scope = namespace || self;

		if(namespace !== void 0)
			element.sf$space = namespace;

		const registrar = scope.registered[name];
		if(registrar === void 0 || element.childNodes.length === 0 && registrar[3] === void 0){
			if(_fromCheck === true)
				return;

			if(waitingHTML[name] === void 0)
				waitingHTML[name] = [];

			waitingHTML[name].push({el:element, item:$item, namespace});
			return;
		}

		const avoid = /(^|:)(sf-|class|style)/;
		const attr = element.attributes;
		const inherit = internal.componentInherit[name];

		if(attr.length !== 0 && $item === void 0)
			$item = {};

		for (var i = 0; i < attr.length; i++) {
			if(avoid.test(attr[i].nodeName))
				continue;

			$item[attr[i].nodeName] = attr[i].value;
		}

		const newObj = (asScope ? $item : (
			inherit !== void 0 ? new inherit() : {}
		));

		let index = 0;
		if(newObj.$el === void 0)
			newObj.$el = $();
		else index = newObj.$el.length;

		if(index === 0){
			const func = registrar[0];
			if(func.constructor === Function){
				if(inherit !== void 0 && asScope)
					Object.setPrototypeOf(newObj, inherit.prototype);

				// Call function that handle scope
				func(newObj, (namespace || sf.model), $item);
			}

			if(newObj.constructor !== Object){
				proxyClass(newObj);
				newObj.constructor.construct && newObj.constructor.construct.call(newObj, (namespace || sf.model), $item);
			}

			// Save the item for hot reloading
			if(hotReload){
				newObj.$el.$item = $item;
				hotComponentAdd(scope, name, newObj);
			}
		}

		if(registrar[4] === void 0)
			registrar[4] = internal.model.createModelKeysRegex(element, newObj, null);

		let forceConnectCall = false;
		if(element.childNodes.length === 0){
			let temp = registrar[3];
			let { tempDOM } = temp;

			// Create template here because we have the sample model
			if(temp.constructor !== Object){
				temp = prepareComponentTemplate(temp, tempDOM, name, newObj, registrar);
				({ tempDOM } = temp);
			}

			// Create new object, but using registrar[3] as prototype
			const copy = Object.create(temp);

			if(copy.parse.length !== 0){
				copy.parse = copy.parse.slice(0);

				// Deep copy the original properties to new object
				for (var i = 0; i < copy.parse.length; i++) {
					copy.parse[i] = Object.create(copy.parse[i]);
					copy.parse[i].data = [null, newObj];
				}
			}

			if(tempDOM === true)
				var parsed = internal.model.templateParser(copy, newObj, void 0, void 0, void 0, element);
			else{
				var parsed = internal.model.templateParser(copy, newObj);
				element.appendChild(parsed);
			}

			element.sf$elementReferences = parsed.sf$elementReferences;
			sf.model.bindElement(element, newObj, copy);
		}

		// Custom component that written on the DOM
		else{
			const specialElement = {
				repeat:[],
				input:[]
			};

			internal.model.templateInjector(element, newObj, false);
			sf.model.parsePreprocess(sf.model.queuePreprocess(element, true, specialElement), newObj, registrar[4]);
			internal.model.bindInput(specialElement.input, newObj);
			internal.model.repeatedListBinding(specialElement.repeat, newObj, namespace, registrar[4]);

			if(element.sf$componentIgnore === true){
				element = newObj.$el[0];

				if(namespace !== void 0)
					element.sf$space = namespace;

				// May cause bug?
				delete element.sf$componentIgnore;
				if(element.isConnected)
					forceConnectCall = true;
			}
		}

		newObj.$el = newObj.$el.push(element);

		registrar[2].push(newObj);
		element.sf$collection = registrar[2];

		element.model = newObj;
		element.sf$controlled = name;

		element.sf$initTriggered = true;
		if(forceConnectCall)
			element.connectedCallback();

		return element;
	}

	class SFComponent extends HTMLElement{
		constructor($item, namespace, asScope){
			super();

			const tagName = this.tagName.toLowerCase();

			if(internal.space.empty === false){
				let haveSpace = namespace || this.closest('sf-space');
				if(haveSpace !== null){
					if(haveSpace.constructor === Space)
						haveSpace = haveSpace.default;

					internal.space.initComponent(haveSpace, tagName, this, $item, asScope);
					return;
				}
			}

			self.new(tagName, this, $item, void 0, asScope);
		}

		connectedCallback(which){
			// Maybe it's not the time
			if(this.model === void 0 || this.sf$componentIgnore === true)
				return;

			if(this.sf$detaching !== void 0){
				clearTimeout(this.sf$detaching);
				this.sf$detaching = void 0;
				return;
			}

			if(this.sf$initTriggered){
				delete this.sf$initTriggered;

				if(this.model.init){
					if(this.model.$el.length !== 1){
						this.model.initClone && this.model.initClone(this.model.$el[this.model.$el.length-1]);
						return;
					}

					if(this.model.constructor !== Object)
						this.model.constructor.init && this.model.constructor.init.call(this.model, (this.sf$space || sf.model));

					this.model.init();
				}
				return;
			}

			if(which !== 'init' && this.model.reinit)
				this.model.reinit(this);
		}

		disconnectedCallback(){
			if(this.sf$componentIgnore)
				return;

			// Skip if it's not initialized
			if(this.model === void 0)
				return;

			const that = this;
			const destroy = function(){
				if(that.model === void 0)
					return;

				if(that.model.$el.length !== 1){
					const i = that.model.$el.indexOf(that);
					if(i !== -1){
						const temp = that.model.$el[i];
						that.model.$el = that.model.$el.splice(i, 1);
						that.model.destroyClone && that.model.destroyClone(temp);
					}

					internal.model.removeModelBinding(that.model);
					return;
				}

				that.model.destroy && that.model.destroy();

				if(that.sf$collection !== void 0)
					that.sf$collection.splice(that.sf$collection.indexOf(that.model), 1);

				if(hotReload)
					hotComponentRemove(that);
			}

			if(window.destroying)
				return destroy();

			this.sf$detaching = setTimeout(destroy, 500);
		}
	}

	if(window.sf$proxy)
		window.sf$defineComponent = defineComponent;

	// name = 'tag-name'
	function defineComponent(name){
		const have = customElements.get(name);
		if(have) return have;

		if(name.toLowerCase() !== name)
			return console.error("Please use lower case when defining component name");

		const len = name.length;
		if(name.replace(/[^\w-]+/g, '').length !== len)
			return console.error("Please use '-' and latin character when defining component tags");

		class Copy extends SFComponent{}
		Copy.prototype.constructor = SFComponent.prototype.constructor;

		if(window.sf$proxy)
			Copy.constructor = window.opener.Function;

		customElements.define(name, Copy);
		return Copy;
	}
})();
;(function(){
var self = sf.model;

self.init = function(el, modelName, namespace){
	if(el.model !== void 0)
		return;

	if(modelName === void 0)
		return console.error("Parameter 2 should be model name");

	el.sf$controlled = modelName;
	if(namespace !== void 0){
		el.sf$namespace = namespace;
		var model = el.model = namespace.root[modelName] || namespace(modelName);
	}
	else var model = el.model = sf.model.root[modelName] || sf.model(modelName);

	var firstInit = false;
	if(model.$el === void 0){
		model.$el = $();
		firstInit = true;
	}

	model.$el = model.$el.push(el);
	if(model.sf$internal === void 0){
		Object.defineProperty(model, 'sf$internal', {enumerabe:false, configurable:true, value:{
			modelKeysRegex:createModelKeysRegex(el, model, null),
			deepBinding:{}
		}});
	}

	if(model.constructor !== Object){
		if(model.sf$internal.proxied === void 0){
			proxyClass(model);
			model.sf$internal.proxied = true;
		}

		model.constructor.construct && model.constructor.construct.call(model, (namespace || sf.model), el);
	}

	var specialElement = {
		repeat:[],
		input:[]
	};

	sf.model.parsePreprocess(sf.model.queuePreprocess(el, void 0, specialElement), model, model.sf$internal.modelKeysRegex);

	bindInput(specialElement.input, model);
	repeatedListBinding(specialElement.repeat, model, namespace, model.sf$internal.modelKeysRegex);

	model.init && model.init(el, firstInit);

	if(model.constructor !== Object)
		model.constructor.init && model.constructor.init.call(model, (namespace || sf.model), el);
}

var processingElement = null;
var scope = internal.model = {};

// For debugging, normalize indentation
function trimIndentation(text){
	var indent = text.split("\n", 3);
	if(indent[0][0] !== ' ' || indent[0][0] !== "\t")
		indent = indent[1];
	else indent = indent[0];

	if(indent === void 0) return text;
	indent = indent.length - indent.trim().length;
	if(indent === 0) return text;
	return text.replace(RegExp('^([\\t ]{'+indent+'})', 'gm'), '');
}

// ToDo: Perf
function _escapeParse(html, vars){
	return avoidQuotes(html, function(noQuot){
		// Escape for value in HTML
		return noQuot.replace(templateParser_regex, function(full, match){
			return sf.dom.escapeText(vars[match]);
		});
	}, function(inQuot){
		// Escape for value in attributes
		return inQuot.replace(templateParser_regex, function(full, match){
			return vars[match] && vars[match].constructor === String
				? vars[match].split('"').join('&quot;').split("'").join("&#39;")
				: vars[match];
		});
	});
}

var modelScript_ = /_result_|return/;
function modelScript(mask, script, repeatedListKey){
	var which = script.match(modelScript_);

	if(which === null)
		script = 'return '+script;
	else if(which[0] === '_result_')
		script = 'var _result_="";'+script.split('@return').join('_result_+=')+';return _result_';
	else
		script = script.split('@return').join('return');

	if(mask && script.includes('_model_'))
		script = script.split('_model_').join(mask);

	var args = mask ? mask : '_model_';
	if(script.includes('_escapeParse') === false)
		args += ',_modelScope,_eP';
	else args += ',_modelScope,_escapeParse';

	try{
		if(repeatedListKey === void 0)
			return new Function(args, script);
		return new Function(args, repeatedListKey, script);
	} catch(e){
		console.log(script);
		console.error(e);
		sf.onerror && sf.onerror(e);
	}
}

var applyParseIndex = internal.model.applyParseIndex = function(templateValue, indexes, parsed, templateParse, item, repeatListIndex){
	for (var i = 0; i < indexes.length; i++){
		var a = indexes[i];
		var temp = parsed[a];

		if(temp !== void 0)
			templateValue[2*i+1] = temp;
		else{
			var ref = templateParse[a];
			temp = ref.data;

			if(item !== temp[1]){
				temp[0] = item;
				temp = ref.get(item, temp[1], _escapeParse, repeatListIndex);
			}
			else temp = ref.get(void 0, temp[1], _escapeParse, repeatListIndex);

			templateValue[2*i+1] = temp.constructor === Object ? JSON.stringify(temp) : temp;
		}
	}

	return templateValue.join('');
}

var parseIndexAllocate = internal.model.parseIndexAllocate = function(arr){
	for (var i = arr.length-1; i > 0; i--)
		arr.splice(i, 0, void 0);

	if(arr[arr.length-1] === '')
		arr.pop();
}
internal.model.removeModelBinding = function(ref, isDeep){
	if(ref === void 0)
		return;

	if(window.sf$proxy !== void 0)
		return window.sf$proxy.removeModelBinding(ref, isDeep);

	const bindedKey = ref.sf$bindedKey;
	for(let key in bindedKey){
		if(ref[key] !== void 0 && (ref[key].constructor === RepeatedProperty || ref[key].constructor === RepeatedList)){
			const obj = ref[key];

			// Deep remove for repeated element, only if it's object data type (primitive don't have sf$bindedKey)
			if(obj.constructor === RepeatedList){
				for (var i = 0; i < obj.length; i++){
					if(typeof obj[i] === 'object')
						internal.model.removeModelBinding(obj[i]);
					else break;
				}
			}
			else{
				for(let rp in obj){
					if(typeof obj[rp] === 'object')
						internal.model.removeModelBinding(obj[rp]);
					else break;
				}
			}

			// Clean ElementManipulator first
			if(obj.$EM.constructor === ElementManipulatorProxy){
				const { list } = obj.$EM;
				for (var i = list.length-1; i >= 0; i--) {
					if(list[i].parentNode.isConnected === false){
						if(!list[i].isComponent)
							repeatedRemoveDeepBinding(obj, list[i].template.modelRef_path);

						list.splice(i, 1);
					}
				}

				if(list.length !== 0)
					continue;
			}
			else if(obj.$EM.parentNode.isConnected === false){
				if(!obj.$EM.isComponent)
					repeatedRemoveDeepBinding(obj, obj.$EM.template.modelRef_path);
			}
			else continue;

			// Clear virtual scroll
			if(obj.$virtual){
				obj.$virtual.destroy();
				delete obj.$virtual;
			}

			delete obj.$EM;
			delete bindedKey[key];
			delete ref[key];
			ref[key] = obj;

			// Reset prototype without copying the array to new reference
			if(obj.constructor === RepeatedList){
				Object.setPrototypeOf(obj, Array.prototype);
				continue;
			}

			// Reset object proxies
			Object.setPrototypeOf(obj, Object.prototype);
			for(let objKey in obj){
				var temp = obj[objKey];
				delete obj[objKey];
				obj[objKey] = temp;
			}

			continue;
		}

		const bindRef = bindedKey[key];
		for (var i = bindRef.length-1; i >= 0; i--) {
			if(bindRef[i].constructor === Function)
				continue;

			if(bindRef[i].element.isConnected === false)
				bindRef.splice(i, 1);
		}

		if(bindRef.input !== void 0){
			for (var i = bindRef.input.length-1; i >= 0; i--) {
				if(bindRef.input[i].isConnected === false)
					bindRef.input.splice(i, 1);
			}

			if(bindRef.input.length === 0)
				for (var i = bindRef.length-1; i >= 0; i--) {
					if(bindRef[i].inputBoundRun)
						bindRef.splice(i, 1);
				}
		}

		if(bindRef.length === 0){
			delete bindedKey[key];

			if(ref[key] === void 0 || Object.getOwnPropertyDescriptor(ref, key).set === void 0)
				continue;

			// Reconfigure / Remove property descriptor
			var temp = ref[key];
			delete ref[key];
			ref[key] = temp;
		}
	}

	// Check for deeper sf$bindingKey
	if(isDeep !== void 0 || ref.sf$internal === void 0)
		return;

	const deep = ref.sf$internal.deepBinding;
	for(let path in deep){
		const model = deepProperty(ref, path.split('%$'));
		if(model !== void 0)
			internal.model.removeModelBinding(model, true);
	}
}


if(window.sf$proxy === void 0)
	forProxying.removeModelBinding = internal.model.removeModelBinding;

function repeatedRemoveDeepBinding(obj, refPaths){
	if(refPaths.length === 0)
		return;

	that:for (let a = 0; a < refPaths.length; a++) {
		if(refPaths[a].length === 1)
			continue;

		const ref = refPaths[a].slice(0, -1);
		if(obj.constructor === RepeatedList){
			for (let i = 0; i < obj.length; i++) {
				var deep = deepProperty(obj[i], ref);
				if(deep === void 0)
					continue;

				internal.model.removeModelBinding(deep);
			}
			continue that;
		}

		for(let key in obj){
			var deep = deepProperty(obj[key], ref);
			if(deep === void 0)
				continue;

			internal.model.removeModelBinding(deep);
		}
	}
}

function modelToViewBinding(model, propertyName, callback, elementBind, type){
	const originalModel = model;
	let originalPropertyName = propertyName;

	// Dive to the last object, create if not exist
	if(propertyName.constructor === Array){
		if(propertyName.length === 1)
			propertyName = propertyName[0];
		else{
			const deep = deepProperty(model, propertyName.slice(0, -1));
			if(deep === void 0)
				return;

			// Register every path as fixed object (where any property replacement will being assigned)
			for (let i = 0, n = propertyName.length-1; i < n; i++) {
				let value = model[propertyName[i]];

				// Return if this not an object
				if(typeof value !== 'object')
					return;

				if(Object.getOwnPropertyDescriptor(model, propertyName[i]).set === void 0){
					Object.defineProperty(model, propertyName[i], {
						enumerable: true,
						configurable: true,
						get(){
							return value;
						},
						set(val){
							Object.assign(value, val);
							return val;
						}
					});
				}

				model = value;
			}

			propertyName = propertyName[propertyName.length-1];
		}
	}

	// We can't redefine length on array
	if(model.constructor === Array && propertyName === 'length')
		return;

	// Enable multiple element binding
	if(model.sf$bindedKey === void 0)
		initBindingInformation(model);

	let bindedKey = model.sf$bindedKey;

	if(bindedKey[propertyName] !== void 0){
		var ref = bindedKey[propertyName];
		if(ref.includes(callback) === false)
			ref.push(callback);

		if(elementBind !== void 0){
			if(ref.input === void 0){
				ref.input = [elementBind];
				ref.input.type = type;
			}
			else ref.input.push(elementBind);
		}
		return;
	}

	// For contributor: don't delete sf$bindedKey from model because can cause memory leak
	bindedKey = bindedKey[propertyName] = [callback];

	if(elementBind !== void 0){
		var ref = bindedKey;
		ref.input = [elementBind];
		ref.input.type = type;
	}

	// Proxy property
	const desc = Object.getOwnPropertyDescriptor(model, propertyName);
	if(desc === void 0 || desc.set !== void 0)
		return;

	if(originalPropertyName.constructor === Array){
		// Cache deep sf$bindingKey path if this a shared model
		if(originalModel.sf$internal !== void 0 && originalPropertyName.length !== 1)
			originalModel.sf$internal.deepBinding[originalPropertyName.slice(0, -1).join('%$')] = true;

		originalPropertyName = stringifyPropertyPath(originalPropertyName);
	}

	let objValue = model[propertyName]; // Object value
	if(objValue === void 0 || objValue === null)
		objValue = '';

	let _on = model[`on$${propertyName}`]; // Everytime value's going changed, callback value will assigned as new value
	let _m2v = model[`m2v$${propertyName}`]; // Everytime value changed from script (not from View), callback value will only affect View

	if(_on)
		Object.defineProperty(model, `on$${propertyName}`, {
			set(val){_on = val},
			get(){return _on}
		});

	if(_m2v)
		Object.defineProperty(model, `m2v$${propertyName}`, {
			set(val){_m2v = val},
			get(){return _on}
		});

	Object.defineProperty(model, propertyName, {
		enumerable: true,
		configurable: true,
		get(){
			return objValue;
		},
		set(val){
			if(objValue !== val){
				let newValue, noFeedback, temp;
				if(inputBoundRunning === false){
					if(_m2v !== void 0){
						newValue = _m2v.call(model, val);

						if(newValue !== void 0)
							noFeedback = true;
					}

					if(_on !== void 0)
						newValue = _on.call(model, val, true);
				}

				objValue = newValue !== void 0 ? newValue : val;

				for (let i = 0; i < bindedKey.length; i++) {
					temp = bindedKey[i];
					if(temp.inputBoundRun){
						temp(objValue, bindedKey.input);
						continue;
					}

					syntheticTemplate(temp.element, temp.template, originalPropertyName, originalModel); // false === no update
				}

				if(noFeedback) objValue = val;
			}

			inputBoundRunning = false;
		}
	});
}

self.bindElement = function(element, modelScope, template, localModel, modelKeysRegex){
	if(template === void 0){
		if(element.model !== void 0){
			console.error('Unexpected rebinding', element, 'Try wrap the level one {{ mustache }} with an <element/>');
			return;
		}

		if(element.parentNode !== null && element.parentNode.hasAttribute('sf-lang'))
			return;

		template = self.extractPreprocess(element, null, modelScope, void 0, modelKeysRegex);
		templateParser(template, modelScope, true);
		delete template.addresses;

		if(element.parentNode !== null){
			const newElem = template.html;
			if(element.tagName.includes('-')){
				newElem.sf$componentIgnore = true;
				element.sf$componentIgnore = true;
				modelScope.$el[0] = newElem;
			}

			element.parentNode.replaceChild(newElem, element);
		}

		element = template.html;
		delete template.html;
	}

	// modelRefRoot_path index is not related with modelRefRoot property/key position
	let properties = template.modelRefRoot_path;
	for (var i = 0; i < properties.length; i++) {
		modelToViewBinding(modelScope, properties[i], {
			element,
			template
		});
	}

	if(template.modelRef_path !== void 0){
		// Check if there are pending revalidation
		if(template.modelRef_path.revalidate){
			delete template.modelRef_path.revalidate;
			revalidateBindingPath(template.modelRef, template.modelRef_path, localModel);
		}

		properties = template.modelRef_path;
		for (var i = 0; i < properties.length; i++) {
			modelToViewBinding(localModel, properties[i], {
				element,
				template
			});
		}
	}
}
let rejectUntrusted = false;
sf.security = function(level){
	if(level & 1) rejectUntrusted = true;
}

function eventHandler(that, data, _modelScope, rootHandler, template){
	const modelKeys = sf.model.modelKeys(_modelScope, true);

	let direct = false;
	let script = data.value;
	script = avoidQuotes(script, function(script_){
		if(sfRegex.anyOperation.test(script_) === false)
			direct = true;

		// Replace variable to refer to current scope
		return script_.replace(template.modelRefRoot_regex, (full, before, matched)=> before+'_modelScope.'+matched);
	});

	const name_ = data.name.slice(1);

	// Create custom listener for repeated element
	if(rootHandler){
		const elementIndex = $.getSelector(that, true, rootHandler); // `rootHandler` may not the parent of `that`

		if(rootHandler.sf$listListener === void 0)
			rootHandler.sf$listListener = {};

		let withKey = false;
		if(template.uniqPattern !== void 0)
			withKey = true;

		if(direct)
			var func = eval(script);
		else{
			if(withKey)
				var func = new Function('event', '_model_', '_modelScope', template.uniqPattern, script);
			else
				var func = new Function('event', '_model_', '_modelScope', script);
		}

		let listener = rootHandler.sf$listListener[name_];
		if(listener === void 0){
			listener = rootHandler.sf$listListener[name_] = [[elementIndex, func]];
			listener.set = new Set([elementIndex.join('')]);
		}
		else{
			if(listener.set.has(elementIndex.join('')) === false){
				listener.push([elementIndex, func]);
				listener.set.add(elementIndex.join(''));
			}
			return;
		}

		let found = null;
		const findEventFromList = function(arr){
			// Partial array compare ([0,1,2] with [0,1,2,3,4] ==> true)
			parent:for (let i = 0; i < listener.length; i++) {
				const ref = listener[i];
				if(arr === void 0){
					if(ref[0].length !== 0)
						continue;

					found = ref[0];
					return ref[1];
				}

				const ref2 = ref[0];
				for (let z = 0; z < ref2.length; z++) {
					if(ref2[z] !== arr[z])
						continue parent;
				}

				found = ref[0];
				return ref[1];
			}

			return;
		}

		// We need to get element with 'sf-bind-list' and check current element before processing
		script = function(event){
			const elem = event.target;
			if(elem === rootHandler)
				return;

			if(!elem.sf$elementReferences || !elem.sf$elementReferences.template.bindList){
				const realThat = findBindListElement(elem);
				if(realThat === null)
					return;

				var call = findEventFromList($.getSelector(elem, true, realThat));
				if(call !== void 0)
					call.call($.childIndexes(found, realThat), event, realThat.model, _modelScope, withKey && realThat.sf$repeatListIndex);

				return;
			}

			var call = findEventFromList(void 0);
			if(call !== void 0)
				call.call(event.target, event, event.target.model, _modelScope, withKey && event.target.sf$repeatListIndex);
		};
	}

	// Get function reference
	else if(direct)
		script = eval(script);

	// Wrap into a function, var event = firefox compatibility
	else script = (new Function('_modelScope', 'event', script)).bind(that, _modelScope);

	let containSingleChar = false;
	let keys = name_.split('.');
	let eventName = keys.shift();

	if(eventName === 'unfocus')
		eventName = 'blur';

	for (let i = keys.length - 1; i >= 0; i--) {
		if(keys[i].length === 1){
			containSingleChar = true;
			break;
		}
	}

	keys = new Set(keys);
	if(rejectUntrusted)
		keys.add('trusted');

	const options = {};
	if(keys.has('once')){
		options.once = true;
		keys.delete('once');
	}

	if(keys.has('passive')){
		if(keys.has('prevent'))
			console.error("Can't preventDefault when using passive listener", that);

		options.passive = true;
		keys.delete('passive');
	}

	// https://dev.to/clickys/bubble-vs-capture--3b19
	if(keys.has('capture')){
		options.capture = true;
		keys.delete('capture');
	}

	if(keys.has('right') && (eventName.includes('mouse') || eventName.includes('pointer'))){
		// Prevent context menu on mouse event
		(rootHandler || that).addEventListener('contextmenu', function(ev){
			ev.preventDefault();
		}, options);
	}

	if(specialEvent[eventName]){
		specialEvent[eventName](that, keys, script, _modelScope, rootHandler);
		return;
	}

	let pointerCode = 0;
	if(keys.has('left')){ pointerCode |= 1; keys.delete('left'); }
	if(keys.has('middle')){ pointerCode |= 2; keys.delete('middle'); }
	if(keys.has('right')){ pointerCode |= 4; keys.delete('right'); }
	if(keys.has('4th')){ pointerCode |= 8; keys.delete('4th'); }
	if(keys.has('5th')){ pointerCode |= 16; keys.delete('5th'); }

	let modsCode = 0;
	if(keys.has('ctrl')){ modsCode |= 1; keys.delete('ctrl'); }
	if(keys.has('alt')){ modsCode |= 2; keys.delete('alt'); }
	if(keys.has('shift')){ modsCode |= 4; keys.delete('shift'); }
	if(keys.has('meta')){ modsCode |= 8; keys.delete('meta'); }

	if(direct && keys.size === 0 && pointerCode === 0 && modsCode === 0)
		var callback = script;
	else{
		var callback = function(ev){
			if(ev.isTrusted === false && keys.has('trusted')){
				if(rejectUntrusted && sf.security.report)
					sf.security.report(ev);

				return;
			}

			if(keys.has('stop'))
				ev.stopPropagation();
			else if(keys.has('stopAll')){
				ev.stopImmediatePropagation();
				ev.stopPropagation();
			}

			if(ev.ctrlKey !== void 0 && modsCode !== 0){
				if(modsCode & 1 && ev.ctrlKey !== true
					|| modsCode & 2 && ev.altKey !== true
					|| modsCode & 4 && ev.shiftKey !== true
					|| modsCode & 8 && ev.metaKey !== true)
					return;
			}

			if(ev.constructor === KeyboardEvent){
				if(containSingleChar && !keys.has(ev.key))
					return;

				ev.preventDefault();
			}

			/*
			0 : No button or un-initialized
			1 : Primary button (usually the left button)
			2 : Secondary button (usually the right button)
			4 : Auxilary button (usually the mouse wheel button or middle button)
			8 : 4th button (typically the "Browser Back" button)
			16 : 5th button (typically the "Browser Forward" button)
			*/
			else if(ev.constructor === MouseEvent || ev.constructor === PointerEvent){
				if(pointerCode !== 0 && !(ev.buttons === 0 ? pointerCode & (1 << (ev.which-1)) : ev.buttons === pointerCode))
					return;

				ev.preventDefault();
			}

			else if(ev.constructor === TouchEvent){
				if(containSingleChar && !keys.has(ev.touches.length))
					return;

				ev.preventDefault();
			}

			else if(keys.has('prevent'))
				ev.preventDefault();

			script.call(this, ev);
		}
	}

	(rootHandler || that).addEventListener(eventName, callback, options);

	// ToDo: Check if there are unused event attachment on detached element
	// console.error(231, rootHandler, that, eventName, callback, options);

	if(options.once === void 0){
		(rootHandler || that)[`sf$eventDestroy_${eventName}`] = function(){
			(rootHandler || that).removeEventListener(eventName, callback, options);
		}
	}

	// Avoid small memory leak when event still listening
	if(rootHandler)
		that = null;
}

const toDegree = 180/Math.PI;
var specialEvent = internal.model.specialEvent = {
	taphold(that, keys, script, _modelScope){
		const set = new Set();
		let evStart = null;

		function callback(){
			that.removeEventListener('pointerup', callbackEnd, {once:true});
			that.removeEventListener('pointercancel', callbackEnd, {once:true});

			view.removeEventListener('pointermove', callbackMove);
			set.delete(evStart.pointerId);

			script.call(that, evStart);
		}

		function callbackMove(ev){
			if(Math.abs(evStart.clientX - ev.clientX) > 1 || Math.abs(evStart.clientY - ev.clientY) > 1){
				clearTimeout(timer);
				set.delete(ev.pointerId);
				that.removeEventListener('pointerup', callbackEnd, {once:true});
				that.removeEventListener('pointercancel', callbackEnd, {once:true});
				view.removeEventListener('pointermove', callbackMove);

				evStart = null;
			}
		}

		var timer = 0;
		var view = document;

		function callbackStart(ev){
			clearTimeout(timer);

			view = ev.view.document;

			set.add(ev.pointerId);
			if(set.size > 1){
				ev.preventDefault();
				ev.stopPropagation();

				that.removeEventListener('pointerup', callbackEnd, {once:true});
				that.removeEventListener('pointercancel', callbackEnd, {once:true});
				view.removeEventListener('pointermove', callbackMove);
				return;
			}

			evStart = ev;
			timer = setTimeout(callback, 700);

			that.addEventListener('pointerup', callbackEnd, {once:true});
			that.addEventListener('pointercancel', callbackEnd, {once:true});
			view.addEventListener('pointermove', callbackMove);
		}

		function callbackEnd(ev){
			view.removeEventListener('pointermove', callbackMove);
			evStart = null;

			set.delete(ev.pointerId);
			clearTimeout(timer);
		}

		that.addEventListener('pointerdown', callbackStart);

		that['sf$eventDestroy_taphold'] = function(){
			that.removeEventListener('pointerdown', callbackStart);
		}
	},
	gesture(that, keys, script, _modelScope){
		touchGesture(that, function callback(data){
			script.call(that, data);
		});
	},
	dragmove(that, keys, script, _modelScope){
		that.style.touchAction = 'none';
		function callbackMove(ev){
			ev.stopPropagation();
			ev.preventDefault();
			ev.stopImmediatePropagation();
			script.call(that, ev);
		}

		function prevent(ev){ev.preventDefault()}

		let view = document;
		const callbackStart = function(ev){
			ev.preventDefault();
			ev.stopPropagation();

			script.call(that, ev);
			view = ev.view.document;

			view.addEventListener('pointermove', callbackMove);
			view.addEventListener('touchmove', prevent, {passive: false});
			view.addEventListener('pointerup', callbackEnd, {once:true});
			view.addEventListener('pointercancel', callbackEnd, {once:true});
		}

		const callbackEnd = function(ev){
			ev.preventDefault();
			ev.stopPropagation();

			script.call(that, ev);
			view = ev.view.document;

			view.removeEventListener('pointermove', callbackMove);
			view.removeEventListener('touchmove', prevent, {passive: false});
			view.removeEventListener('pointercancel', callbackEnd, {once:true});
			that.addEventListener('pointerdown', callbackStart, {once:true});
		};

		that.addEventListener('pointerdown', callbackStart);

		that['sf$eventDestroy_dragmove'] = function(){
			that.removeEventListener('pointerdown', callbackStart, {once:true});
			document.removeEventListener('pointermove', callbackMove);
			document.removeEventListener('pointercancel', callbackEnd, {once:true});
			document.removeEventListener('pointerup', callbackEnd, {once:true});
		}
	},
	filedrop(that, keys, script, _modelScope){
		that.addEventListener('dragover', function dragover(ev){
			ev.preventDefault();
		});

		that.addEventListener('drop', function drop(ev){
			ev.preventDefault();

			if(ev.dataTransfer.items) {
				const found = [];
				for (let i = 0; i < ev.dataTransfer.items.length; i++) {
					if (ev.dataTransfer.items[i].kind === 'file')
						found.push(ev.dataTransfer.items[i].getAsFile());
				}

				script.call(that, found);
			}
			else script.call(that, ev.dataTransfer.files);
		});

		that['sf$eventDestroy_filedrop'] = function(){
			that.removeEventListener('dragover', dragover);
			that.removeEventListener('drop', drop);
		}
	}
};

function touchGesture(that, callback){
	let startScale = 0;
	let startAngle = 0;
	let lastScale = 0;
	let lastAngle = 0;
	let actionBackup = '';

	let force = false;
	const pointers = [];

	function findAnd(action, ev){
		for (let i = pointers.length - 1; i >= 0; i--) {
			if(pointers[i].pointerId === ev.pointerId){
				if(action === 2) // delete
					pointers.splice(i, 1);
				else if(action === 1) // replace
					pointers[i] = ev;
				return;
			}
		}

		if(action === 0) // add
			pointers.push(ev);
	}

	let view = document;
	const callbackStart = function(ev){
		ev.preventDefault();
		findAnd(0, ev);

		view = ev.view.document;

		if(pointers.length === 1){
			if(force)
				pointers.unshift({
					pointerId:'custom',
					clientX:that.offsetLeft + that.offsetWidth/2,
					clientY:that.offsetTop + that.offsetHeight/2
				});

			actionBackup = that.style.touchAction;
			that.style.touchAction = 'none';

			view.addEventListener('pointerup', callbackEnd);
			view.addEventListener('pointercancel', callbackEnd);
		}

		if(pointers.length === 2){
			ev.stopPropagation();

			const dx = pointers[1].clientX - pointers[0].clientX;
			const dy = pointers[1].clientY - pointers[0].clientY;

			lastScale = startScale = Math.sqrt(dx**2 + dy**2) * 0.01;
			lastAngle = startAngle = Math.atan2(dy, dx) * toDegree;

			ev.scale =
			ev.angle =
			ev.totalScale =
			ev.totalAngle = 0;

			callback(ev);
			view.addEventListener('pointermove', callbackMove);
		}
		else view.removeEventListener('pointermove', callbackMove);
	}

	const callbackMove = function(ev){
		ev.preventDefault();
		ev.stopPropagation();
		ev.stopImmediatePropagation();
		findAnd(1, ev);

		const p1 = pointers[0];
		const p2 = pointers[1];
		const dx = p2.clientX - p1.clientX;
		const dy = p2.clientY - p1.clientY;

		const currentScale = Math.sqrt(dx**2 + dy**2) * 0.01;
		const currentAngle = Math.atan2(dy, dx) * toDegree;

		ev.scale = currentScale - lastScale;
		ev.angle = currentAngle - lastAngle;
		ev.totalScale = currentScale - startScale;
		ev.totalAngle = currentAngle - startAngle;

		callback(ev);

		lastScale = currentScale;
		lastAngle = currentAngle;
	};

	const callbackEnd = function(ev){
		ev.preventDefault();
		findAnd(2, ev);

		if(pointers.length <= 1){
			if(pointers.length === 0){
				view.removeEventListener('pointerup', callbackEnd);
				view.removeEventListener('pointercancel', callbackEnd);
			}

			that.style.touchAction = actionBackup;

			view.removeEventListener('pointermove', callbackMove);

			ev.scale = ev.angle = 0;
			ev.totalScale = lastScale - startScale;
			ev.totalAngle = lastAngle - startAngle;
			callback(ev);
		}
		else{
			view.addEventListener('pointerup', callbackEnd);
			view.addEventListener('pointercancel', callbackEnd);

			if(pointers.length === 2){
				view.removeEventListener('pointermove', callbackMove);

				ev.scale = ev.angle = 0;
				callback(ev);
			}
		}
	};

	that.addEventListener('pointerdown', callbackStart);

	that['sf$eventDestroy_gesture'] = function(){
		that.removeEventListener('pointerdown', callbackStart);
		$(sf.window).off('keydown', keyStart);
	}

	const keyEnd = function(ev){
		if(!force || ev.ctrlKey)
			return;

		force = false;
		pointers.length = 0;

		view.removeEventListener('pointermove', callbackMove);
		view.removeEventListener('keyup', keyEnd);
	};

	const keyStart = function(ev){
		if(!ev.ctrlKey)
			return;

		view = ev.view.document;

		force = true;
		view.addEventListener('keyup', keyEnd);
	};

	$(sf.window).on('keydown', keyStart);
}
let inputBoundRunning = false;
const callInputListener = function(ref, value){
	const v2m = ref.sfModel[`v2m$${ref.sfBounded}`];
	const on = ref.sfModel[`on$${ref.sfBounded}`];

	if(v2m !== void 0 || on !== void 0){
		let newValue;
		let old = ref.sfModel[ref.sfBounded];

		if(old !== null && old !== void 0 && old.constructor === Array)
			old = old.slice(0);

		try{
			if(v2m !== void 0)
				newValue = v2m.call(ref.sfModel, value);

			if(on !== void 0){
				newValue = on.call(ref.sfModel, value, false);
				if(newValue !== void 0)
					ref.sfFeedback = true;
			}
		}catch(e){
			console.error(e);
			sf.onerror && sf.onerror(e);
		}

		return newValue;
	}
}

const inputTextBound = function(e){
	if(e.fromSFFramework === true) return;

	const ref = inputBoundRunning = e.target;
	ref.viewInputted = true;
	const value = ref.typeData === Number ? Number(ref.value) : ref.value;
	const newValue = callInputListener(ref, value);

	if(ref.sfFeedback){
		ref.sfFeedback = false;
		ref.value = newValue;
	}

	ref.sfModel[ref.sfBounded] = newValue !== void 0 ? newValue : value;
}

const inputFilesBound = function(e){
	if(e.fromSFFramework === true) return;

	const ref = e.target;
	const newValue = callInputListener(ref, ref.files);
	if(newValue !== void 0){
		if(!newValue || newValue.length === 0)
			ref.value = '';
		else{
			const temp = new DataTransfer();
			for (let i = 0; i < newValue.length; i++)
				temp.items.add(newValue[i]);

			ref.sfModel[ref.sfBounded] = temp.files;
			if(ref.sfFeedback){
				ref.sfFeedback = false;
				ref.files = temp.files;
			}
		}
	}
	else ref.sfModel[ref.sfBounded] = ref.files;
}

const inputCheckBoxBound = function(e){
	if(e.fromSFFramework === true) return;

	const ref = inputBoundRunning = e.target;
	ref.viewInputted = true;

	const model = ref.sfModel;
	const { constructor } = model[ref.sfBounded];

	let value;
	if(constructor === Boolean || ref.typeData === Boolean)
		value = ref.checked;
	else if(ref.typeData === Number)
		value = Number(ref.value);
	else
		({ value } = ref);

	const newValue = callInputListener(ref, value);
	if(newValue !== void 0){
		value = newValue;

		if(ref.sfFeedback){
			ref.sfFeedback = false;
			assignElementData.checkbox(value, ref);
		}
	}

	if(constructor === Array){
		const i = model[ref.sfBounded].indexOf(value);

		if(i === -1 && ref.checked === true)
			model[ref.sfBounded].push(value);
		else if(i !== -1 && ref.checked === false)
			model[ref.sfBounded].splice(i, 1);
	}
	else model[ref.sfBounded] = value;
}

const inputSelectBound = function(e){
	if(e.fromSFFramework === true) return;

	const ref = inputBoundRunning = e.target;
	ref.viewInputted = true;
	const { typeData } = ref;

	let value = [];
	if(ref.multiple === true){
		const temp = ref.selectedOptions;
		for (let i = 0; i < temp.length; i++)
			value.push(typeData === Number ? Number(temp[i].value) : temp[i].value);
	}
	else value = typeData === Number ? Number(ref.selectedOptions[0].value) : ref.selectedOptions[0].value;

	const newValue = callInputListener(ref, value);
	if(newValue !== void 0){
		if(ref.sfFeedback){
			ref.sfFeedback = false;
			assignElementData.select(newValue, ref);
		}

		ref.sfModel[ref.sfBounded] = newValue;
	}
	else ref.sfModel[ref.sfBounded] = value;
}

var assignElementData = {
	select(val, element){
		const list = element.options;
		const { typeData } = element;

		if(val.constructor !== Array){
			for (var i = 0, n = list.length; i < n; i++) {
				if(typeData === String)
					list[i].selected = list[i].value === val;
				else list[i].selected = list[i].value == val;
			}
		}
		else for (var i = 0, n = list.length; i < n; i++)
			list[i].selected = val.includes(typeData === Number ? Number(list[i].value) : list[i].value);
	},
	checkbox(val, element){
		if(val.constructor === Array)
			element.checked = val.includes(element.typeData === Number ? Number(element.value) : element.value);
		else if(val.constructor === Boolean)
			element.checked = Boolean(val);
		else{
			if(element.typeData === String)
				element.checked = element.value === val;
			else element.checked = element.value == val;
		}
	},
	file(val, element){
		if(!val || val.length === 0)
			element.value = '';
		else{
			const temp = new DataTransfer();
			for (let i = 0; i < val.length; i++)
				temp.items.add(val[i]);

			element.files = temp.files;
		}
	}
}

const inputBoundRun = function(val, elements){
	if(val === null || val === void 0)
		return;

	for (let i = 0; i < elements.length; i++) {
		if(inputBoundRunning === elements[i])
			continue; // Avoid multiple assigment

		if(elements.type === 1) // text
			elements[i].value = val;
		else if(elements.type === 2) // select options
			assignElementData.select(val, elements[i]);
		else if(elements.type === 3) // radio
			elements[i].checked = val == elements[i].value;
		else if(elements.type === 4) // checkbox
			assignElementData.checkbox(val, elements[i]);
		else if(elements.type === 5){ // file
			assignElementData.file(val, elements[i]);
			continue;
		}

		const ev = new Event('change');
		ev.fromSFFramework = true;
		elements[i].dispatchEvent(ev);
	}
}

// For dynamic reference checking
inputBoundRun.inputBoundRun = true;

const triggerInputEvent = function(e){
	if(e.fromSFFramework === true) return;
	if(e.target.viewInputted === true){
		e.target.viewInputted = false;
		return;
	}
	e.target.dispatchEvent(new Event('input'));
}

const elementBoundChanges = function(model, property, element, oneWay, modelLocal, propertyNameLocal){
	// Enable multiple element binding
	if(model.sf$bindedKey === void 0)
		initBindingInformation(model);

	const val = model[property];

	var type = 0;
	let typeData = null;
	if(val !== null && val !== void 0)
		typeData = val.constructor;

	const assignedType = (element.getAttribute('typedata') || '').toLowerCase();
	if(assignedType === 'number')
		typeData = Number;

	element.typeData = typeData;
	$.on(element, 'change', triggerInputEvent);

	// Bound value change
	if(element.tagName === 'TEXTAREA'){
		$.on(element, 'input', inputTextBound);
		type = 1;

		if(oneWay === false)
			element.value = val;
	}
	else if(element.selectedOptions !== void 0){
		$.on(element, 'input', inputSelectBound);
		type = 2;

		assignElementData.select(val, element);
	}
	else{
		var type = element.type.toLowerCase();
		if(type === 'radio'){
			$.on(element, 'input', inputTextBound);
			type = 3;

			element.checked = val == element.value;
		}
		else if(type === 'checkbox'){
			$.on(element, 'input', inputCheckBoxBound);
			type = 4;

			assignElementData.checkbox(val, element);
		}
		else if(type === 'file'){
			$.on(element, 'input', inputFilesBound);
			type = 5;
		}
		else{
			$.on(element, 'input', inputTextBound);
			type = 1;

			if(oneWay === false)
				element.value = val;
		}
	}

	if(oneWay === true) return;
	modelToViewBinding(modelLocal, propertyNameLocal || property, inputBoundRun, element, type);
}

const bindInput = internal.model.bindInput = function(temp, modelLocal, mask, modelScope){
	let element, oneWay, propertyName;

	for (let i = 0; i < temp.length; i++) {
		if(temp[i].getAttribute === void 0){
			element = temp[i].el;
			oneWay = temp[i].id === 1;
			propertyName = temp[i].rule;
		}
		else{
			element = temp[i];
			oneWay = element.hasAttribute('sf-into');
			propertyName = oneWay ? element.getAttribute('sf-into') : element.getAttribute('sf-bind');

			if(oneWay === false)
				element.removeAttribute('sf-bind');
			else
				element.removeAttribute('sf-into');
		}

		if(propertyName === "")
			propertyName = element.getAttribute('name');

		if(propertyName === null){
			console.error("Property key to be bound wasn't be found", element);
			continue;
		}

		let model = modelLocal;
		let currentModel = modelLocal;
		if(mask !== void 0){
			if(propertyName.indexOf(mask+'.') === 0)
				propertyName = propertyName.replace(/\w+\./, '');
			else
				currentModel = model = modelScope;
		}

		// Get reference
		let propertyNameLocal = null;
		if(model[propertyName] === void 0){
			let deepScope = parsePropertyPath(propertyName);
			propertyNameLocal = deepScope.slice();

			if(deepScope.length !== 1){
				var property = deepScope.pop();
				deepScope = deepProperty(model, deepScope);
			}
			else deepScope = void 0;

			if(deepScope === void 0){
				console.error(`Can't get property "${propertyName}" on model`, model);
				return;
			}

			model = deepScope;
			propertyName = property;
		}

		element.sfBounded = propertyName;
		element.sfModel = model;

		elementBoundChanges(model, propertyName, element, oneWay, currentModel, propertyNameLocal);
	}
}
// ToDo: extract style attribute and use direct change into the CSS Style instead of modify attribute

// For contributor of this library
// Please be careful when you're passing the eval argument
// .apply() or spread ...array is slower than direct function call
// object[0] is slower than array[0]

// ToDo: directly create parse_index from here
const dataParser = function(html, _model_, template, _modelScope, preParsedReference, justName){
	const preParsed = [];
	const lastParsedIndex = preParsedReference.length;

	const prepared = html.replace(sfRegex.dataParser, function(actual, temp){
		temp = avoidQuotes(temp, function(temp_){
			// Unescape HTML
			temp_ = temp_.split('&amp;').join('&').split('&lt;').join('<').split('&gt;').join('>');

			// Mask item variable
			if(template.modelRef_regex !== void 0)
				temp_ = temp_.replace(template.modelRef_regex, (full, left, right)=> left+'_model_'+right);

			// Mask model for variable
			return temp_.replace(template.modelRefRoot_regex, (full, before, matched)=> before+'_modelScope.'+matched);
		});

		temp = temp.trim();

		// Simplicity similar
		const exist = preParsed.indexOf(temp);

		if(exist === -1){
			preParsed.push(temp);
			if(justName === true)
				preParsedReference.push(temp);
			else
				preParsedReference.push({type:REF_DIRECT, data:[temp, _model_, _modelScope]});
			return `{{%=${preParsed.length + lastParsedIndex - 1}%`;
		}
		return `{{%=${exist + lastParsedIndex}%`;
	});

	return prepared;
}

// Dynamic data parser
const uniqueDataParser = function(html, template, _modelScope){
	// Build script preparation
	html = html.replace(sfRegex.allTemplateBracket, function(full, matched){ // {[ ... ]}
		if(sfRegex.anyCurlyBracket.test(matched) === false) // {{ ... }}
			return `_result_ += '${matched.split("\\").join("\\\\").split("'").join("\\'").split("\n").join("\\\n")}'`;

		const vars = [];
		matched = dataParser(matched, null, template, _modelScope, vars, true)
				.split('\\').join('\\\\').split('"').join('\\"').split("\n").join("\\\n");

		return `_result_ += (function(){return _escapeParse("${matched}", [${vars.join(',')} ])}).apply(null, arguments);`;
	});

	const preParsedReference = [];
	const prepared = html.replace(sfRegex.uniqueDataParser, function(actual, temp){
		temp = avoidQuotes(temp, function(temp_){
			// Unescape HTML
			temp_ = temp_.split('&amp;').join('&').split('&lt;').join('<').split('&gt;').join('>');

			// Mask item variable
			if(template.modelRef_regex !== void 0)
				temp_ = temp_.replace(template.modelRef_regex, (full, left, right)=> left+'_model_'+right);

			// Mask model for variable
			return temp_.replace(template.modelRefRoot_regex, (full, before, matched)=> before+'_modelScope.'+matched);
		});

		let check = false;
		check = temp.split('@if ');
		if(check.length !== 1){
			check = check[1].split(':');

			const condition = check.shift();
			const elseIf = findElse(check);
			elseIf.type = REF_IF;
			elseIf.data = [null, _modelScope];

			// Trim Data
			elseIf.if = [condition.trim(), elseIf.if.trim()];
			if(elseIf.elseValue !== null)
				elseIf.elseValue = elseIf.elseValue.trim();

			for (let i = 0; i < elseIf.elseIf.length; i++) {
				const ref = elseIf.elseIf[i];
				ref[0] = ref[0].trim();
				ref[1] = ref[1].trim();
			}

			// Push data
			preParsedReference.push(elseIf);
			return `{{%%=${preParsedReference.length - 1}`;
		}

		// Warning! Avoid unencoded user inputted content
		// And always check/remove closing ']}' in user content
		check = temp.split('@exec');
		if(check.length !== 1){
			preParsedReference.push({type:REF_EXEC, data:[check[1], null, _modelScope]});
			return `{{%%=${preParsedReference.length - 1}`;
		}
		return '';
	});

	return [prepared, preParsedReference];
}

// {if, elseIf:([if, value], ...), elseValue}
var findElse = function(text){
	text = text.join(':');
	var else_ = null;

	// Split elseIf
	text = text.split('@elseif ');

	// Get else value
	var else_ = text[text.length - 1].split('@else');
	if(else_.length === 2){
		text[text.length - 1] = else_[0];
		else_ = else_.pop();
		else_ = else_.substr(else_.indexOf(':') + 1);
	}
	else else_ = null;

	const obj = {
		if:text.shift(),
		elseValue:else_
	};

	// Separate condition script and value
	obj.elseIf = new Array(text.length);
	for (let i = 0; i < text.length; i++) {
		const val = text[i].split(':');
		obj.elseIf[i] = [val.shift(), val.join(':')];
	}

	return obj;
}

function addressAttributes(currentNode, template){
	const attrs = currentNode.attributes;
	const keys = [];
	let indexes = 0;
	for (let a = attrs.length - 1; a >= 0; a--) {
		const attr = attrs[a];
		let found = attr.value.includes('{{%=');
		if(attr.name[0] === '@'){
			// No template processing for this
			if(found){
				console.error("To avoid vulnerability, template can't be used inside event callback", currentNode);
				continue;
			}

			if(template.modelRef_regex)
				attr.value = attr.value.replace(template.modelRef_regex, (full, left, right)=> left+'_model_'+right);

			keys.push({
				name:attr.name,
				value:attr.value.trim(),
				event:true
			});

			currentNode.removeAttribute(attr.name);
		}

		if(found){
			if(attr.name[0] === ':'){
				var key = {
					name:attr.name.slice(1),
					value:attr.value.trim()
				};

				currentNode.removeAttribute(attr.name);
				currentNode.setAttribute(key.name, '');
			}
			else{
				var key = {
					name:attr.name,
					value:attr.value.trim()
				};
				attr.value = '';
			}

			indexes = [];
			found = key.value.replace(templateParser_regex, function(full, match){
				indexes.push(Number(match));
				return '';
			});

			if(found === '' && indexes.length === 1)
				key.direct = indexes[0];
			else{
				key.parse_index = indexes;
				key.value = key.value.replace(/[\t\r\n]/g, '').replace(/ {2,}/g, ' ').split(templateParser_regex_split);
				parseIndexAllocate(key.value);
			}

			keys.push(key);
		}
	}
	return keys;
}

function toObserve(full, model, properties){
	const place = model === '_model_' ? toObserve.template.modelRef : toObserve.template.modelRefRoot;

	// Get property name
	if(place[properties] === void 0){
		place[properties] = [toObserve.template.i];

		if(place === toObserve.template.modelRef)
			toObserve.template.modelRef_path.push(parsePropertyPath(properties));
		else
			toObserve.template.modelRefRoot_path.push(parsePropertyPath(properties));
	}
	else if(place[properties].includes(toObserve.template.i) === false)
		place[properties].push(toObserve.template.i);

	return full;
}

// Return element or
internal.model.templateInjector = function(targetNode, modelScope, cloneDynamic){
	const reservedTemplate = targetNode.getElementsByTagName('sf-reserved');
	const injectTemplate = targetNode.getElementsByTagName('sf-template');

	if(injectTemplate.length !== 0){
		var temp = window.templates;
		if(temp === void 0)
			throw new Error("<sf-template> need `window.templates` to be loaded first");

		for (var i = injectTemplate.length - 1; i >= 0; i--) {
			var ref = injectTemplate[i];
			let path = ref.getAttribute('path')
			if(path === null){
				path = ref.getAttribute('get-path');

				if(path !== null) // below got undefined if not found
					path = deepProperty(window, parsePropertyPath(path));
			}

			var serve;
			if(path !== null){
				if(path !== void 0) {
					if(path[0] === '.' && targetNode.templatePath !== void 0)
						path = path.replace('./', targetNode.templatePath);

					serve = temp[path];
				}
			}
			else {
				path = ref.getAttribute('get-html');
				serve = deepProperty(window, parsePropertyPath(path));
			}

			if(serve === void 0){
				console.log(ref, 'Template path was not found', path);
				ref.remove();
				continue;
			}

			// Need a copy with Array.from
			serve = toArray($.parseElement(serve));
			$(serve).insertBefore(ref.nextSibling || ref);
			ref.remove();
		}
	}

	let isDynamic = reservedTemplate.length !== 0;
	if(cloneDynamic === true && isDynamic === true){
		targetNode.sf$hasReserved = true;
		targetNode.sf$componentIgnore = true;

		var temp = internal.component.skip;
		internal.component.skip = true;
		isDynamic = targetNode.cloneNode(true);
		internal.component.skip = temp;
	}

	if(reservedTemplate.length !== 0){
		if(modelScope.sf$reserved === void 0){
			for (var i = reservedTemplate.length - 1; i >= 0; i--) {
				reservedTemplate[i].remove();
			}
		}
		else{
			var temp = modelScope.sf$reserved;
			for (var i = reservedTemplate.length - 1; i >= 0; i--) {
				var ref = reservedTemplate[i];
				var serve = temp[ref.getAttribute('name')];
				if(serve === void 0){
					ref.remove();
					continue;
				}

				serve = $.parseElement(serve);
				$(serve).insertBefore(ref.nextSibling || ref);
				ref.remove();
			}
		}
	}

	return isDynamic;
}

const createModelKeysRegex = internal.model.createModelKeysRegex = function(targetNode, modelScope, mask){
	const modelKeys = self.modelKeys(modelScope, true);
	if(modelKeys.length === 0){
		console.error(modelScope, $(targetNode.outerHTML)[0]);
		throw new Error("Template model was not found, maybe some script haven't been loaded");
	}

	const obj = {};

	// Don't match text inside quote, or object keys
	obj.modelRefRoot_regex = RegExp(sfRegex.scopeVar+'('+modelKeys+')', 'g');
	if(mask !== null)
		obj.modelRef_regex = RegExp(sfRegex.getSingleMask.join(mask), 'gm');

	obj.modelRef_regex_mask = mask;
	return obj;
}

// ToDo: need performance optimization
self.extractPreprocess = function(targetNode, mask, modelScope, container, modelRegex, preserveRegex, repeatedListKey){
	if(targetNode.model !== void 0)
		return console.error('[Violation] element already has a model, template extraction aborted', targetNode, targetNode.model, mask, modelScope);

	// Remove repeated list from further process
	// To avoid data parser
	const backup = targetNode.querySelectorAll('[sf-repeat-this]');
	for (var i = 0; i < backup.length; i++) {
		var current = backup[i];
		var flag = document.createElement('template');
		flag.classList.add('sf-repeat-this-prepare');
		current.parentNode.replaceChild(flag, current);
	}

	let template;

	// modelRefRoot_regex should be placed on template prototype
	if(modelRegex.parse === void 0)
		template = Object.create(modelRegex);
	else{
		template = {
			modelRefRoot_regex:modelRegex.modelRefRoot_regex,
			modelRef_regex:modelRegex.modelRef_regex,
			modelRef_regex_mask:modelRegex.modelRef_regex_mask,
		};
	}

	// For preparing the next model too
	if(template.modelRef_regex_mask !== mask){
		template.modelRef_regex = RegExp(sfRegex.getSingleMask.join(mask), 'gm');
		template.modelRef_regex_mask = mask;
	}

	template.modelRefRoot = {};
	template.modelRefRoot_path = [];

	// Mask the referenced item
	if(mask !== null){
		template.modelRef = {};
		template.modelRef_path = [];
	}

	let copy = targetNode.outerHTML.replace(/[ \t]{2,}/g, ' ');

	// Extract data to be parsed
	copy = uniqueDataParser(copy, template, modelScope);
	const preParsed = copy[1];
	copy = dataParser(copy[0], null, template, modelScope, preParsed);

	function findModelProperty(){
		for (let i = 0; i < preParsed.length; i++) {
			const current = preParsed[i];

			// Text or attribute
			if(current.type === REF_DIRECT){
				toObserve.template.i = i;
				current.data[0] = current.data[0].replace(sfRegex.itemsObserve, toObserve, template, true);

				// Convert to function
				current.get = modelScript(mask, current.data.shift(), repeatedListKey);
				continue;
			}

			// Dynamic data
			if(current.type === REF_IF){
				var checkList = current.if.join(';');
				current.if[0] = modelScript(mask, current.if[0], repeatedListKey);
				current.if[1] = modelScript(mask, current.if[1], repeatedListKey);

				if(current.elseValue !== null){
					checkList += `;${current.elseValue}`;
					current.elseValue = modelScript(mask, current.elseValue, repeatedListKey);
				}

				for (let a = 0; a < current.elseIf.length; a++) {
					const refElif = current.elseIf[a];

					checkList += refElif.join(';');
					refElif[0] = modelScript(mask, refElif[0], repeatedListKey);
					refElif[1] = modelScript(mask, refElif[1], repeatedListKey);
				}
			}
			else if(current.type === REF_EXEC){
				var checkList = current.data.shift();

				// Convert to function
				current.get = modelScript(mask, checkList, repeatedListKey);
			}

			toObserve.template.i = i;
			checkList.split('"').join("'").replace(sfRegex.itemsObserve, toObserve);
		}
	}

	// Rebuild element
	const tempSkip = internal.component.skip;
	internal.component.skip = true;
	if(container !== void 0)
		copy = `<${container}>${copy}</${container}>`;

	copy = $.parseElement(copy, true)[0];
	if(container !== void 0){
		copy = copy.firstElementChild;
		copy.remove();
	}

	internal.component.skip = tempSkip;

	// Restore element repeated list
	const restore = copy.getElementsByClassName('sf-repeat-this-prepare');
	for (var i = 0; i < backup.length; i++) {
		var current = restore[0];
		current.parentNode.replaceChild(backup[i], current);
	}

	template.specialElement = {
		repeat:[],
		input:[],
	};

	// It seems we can't use for.. of because need to do from backward
	// Start addressing
	const nodes = Array.from(self.queuePreprocess(copy, true, template.specialElement));
	const addressed = [];

	for (var i = nodes.length - 1; i >= 0; i--) {
		var ref = nodes[i];
		const temp = {nodeType: ref.nodeType};

		if(temp.nodeType === 1){ // Element
			temp.attributes = addressAttributes(ref, template);
			temp.address = $.getSelector(ref, true);
		}

		else if(temp.nodeType === 3){ // Text node
			let innerHTML = ref.textContent;
			var indexes = [];

			innerHTML.replace(/{{%%=([0-9]+)/gm, function(full, match){
				indexes.push(Number(match));
			});

			// Check for dynamic mode
			if(indexes.length !== 0){
				innerHTML = innerHTML.split(/{{%%=[0-9]+/gm);
				for (var a = 0; a < innerHTML.length; a++) {
					innerHTML[a] = trimIndentation(innerHTML[a]).trim();
				}
				ref.textContent = innerHTML.shift();

				const parent = ref.parentNode;
				const { nextSibling } = ref;

				// Dynamic boundary start
				let addressStart = null;
				if(indexes.length !== 0 && ref.textContent.length !== 0)
					addressStart = $.getSelector(ref, true);
				else if(ref.previousSibling !== null)
					addressStart = $.getSelector(ref.previousSibling, true);

				// Find boundary ends
				const commentFlag = addressed.length;
				for(var a = 0; a < indexes.length; a++){
					var flag = document.createComment('');
					parent.insertBefore(flag, nextSibling);

					// Add comment element as a flag
					addressed.push({
						nodeType:-1,
						parse_index:indexes[a],
						startFlag:addressStart,
						address:$.getSelector(flag, true)
					});

					if(innerHTML[a]){
						const textNode = document.createTextNode(innerHTML[a]);
						parent.insertBefore(textNode, nextSibling);

						// Get new start flag
						if(a + 1 < indexes.length)
							addressStart = $.getSelector(textNode, true);
					}
					else if(addressStart !== null && a + 1 < indexes.length){
						addressStart = addressStart.slice();
						addressStart[addressStart.length-1]++;
					}
				}

				// Merge boundary address
				if(ref.textContent === ''){
					ref.remove();

					// Process the comment flag only
					for (var a = commentFlag; a < addressed.length; a++) {
						var ref = addressed[a].address;
						ref[ref.length - 1]--;
					}
					continue;
				}
				else if(ref.textContent.search(/{{%=[0-9]+%/) === -1)
					continue;
			}

			// Check if it's only model value
			indexes = [];
			innerHTML = ref.textContent.replace(templateParser_regex, function(full, match){
				indexes.push(Number(match));
				return '';
			});

			if(innerHTML === '' && indexes.length === 1)
				temp.direct = indexes[0];
			else{
				temp.value = ref.textContent.replace(/[ \t]{2,}/g, ' ').split(templateParser_regex_split);
				parseIndexAllocate(temp.value);
				temp.parse_index = indexes;
			}

			temp.address = $.getSelector(ref, true);
			ref.textContent = '-';
		}

		addressed.push(temp);
	}

	toObserve.template = template;
	findModelProperty();

	delete toObserve.template.i;
	toObserve.template = void 0;

	revalidateTemplateRef(template, modelScope);

	// Get the indexes for input bind
	if(template.specialElement.input.length !== 0){
		const specialInput = template.specialElement.input;
		for (var i = 0; i < specialInput.length; i++) {
			var el = specialInput[i];
			var id, rule;

			if(el.hasAttribute('sf-into')){ // One way
				id = 1;
				rule = el.getAttribute('sf-into');
				el.removeAttribute('sf-into');
			}
			else{
				id = 2;
				rule = el.getAttribute('sf-bind');
				el.removeAttribute('sf-bind');
			}

			specialInput[i] = {
				addr:$.getSelector(el, true),
				rule,
				id
			};
		}
	}
	else delete template.specialElement.input;

	// Get the indexes for sf-repeat-this
	if(template.specialElement.repeat.length !== 0){
		const specialRepeat = template.specialElement.repeat;
		for (var i = 0; i < specialRepeat.length; i++) {
			var el = specialRepeat[i];
			specialRepeat[i] = {
				addr:$.getSelector(el, true),
				rule:el.getAttribute('sf-repeat-this')
			};

			el.removeAttribute('sf-repeat-this');
		}
	}
	else{
		if(!template.specialElement.input)
			delete template.specialElement;
		else delete template.specialElement.repeat;
	}

	// internal.language.refreshLang(copy);
	template.html = copy;
	template.parse = preParsed;
	template.addresses = addressed;

	if(preserveRegex === void 0 && modelRegex.parse !== void 0){
		delete template.modelRefRoot_regex;
		delete template.modelRef_regex;
		delete template.modelRef_regex_mask;
	}

	return template;
}

let enclosedHTMLParse = false;
const excludes = {HTML:1,HEAD:1,STYLE:1,LINK:1,META:1,SCRIPT:1,OBJECT:1,IFRAME:1};
self.queuePreprocess = function(targetNode, extracting, collectOther, temp){
	const { childNodes } = targetNode;

	if(temp === void 0){
		temp = new Set();

		var attrs = targetNode.attributes;
		for (var a = 0; a < attrs.length; a++) {
			if(attrs[a].name[0] === '@' || attrs[a].value.includes('{{')){
				temp.add(targetNode);
				targetNode.sf$onlyAttribute = true;
				break;
			}
		}
	}

	// Scan from last into first element
	for (let i = childNodes.length - 1; i >= 0; i--) {
		const currentNode = childNodes[i];

		if(excludes[currentNode.nodeName] !== void 0)
			continue;

		if(currentNode.nodeType === 1){ // Tag
			// Skip {[ ..enclosed template.. ]}
			if(enclosedHTMLParse === true)
				continue;

			// Skip nested sf-model or sf-space
			// Skip element and it's childs that already bound to prevent vulnerability
			if(currentNode.tagName === 'SF-M' || currentNode.model !== void 0)
				continue;

			var attrs = currentNode.attributes;
			if(attrs['sf-repeat-this'] !== void 0){
				collectOther.repeat.push(currentNode);
				continue;
			}

			if(attrs['sf-into'] !== void 0 || attrs['sf-bind'] !== void 0)
				collectOther.input.push(currentNode);

			// Skip any custom element
			if(currentNode.hasAttribute('sf-parse') === false && currentNode.tagName.includes('-')){
				if(currentNode.tagName !== 'SF-PAGE-VIEW' || currentNode.parentNode.hasAttribute('sf-parse') === false)
					continue;
			}

			for (var a = 0; a < attrs.length; a++) {
				if(attrs[a].name[0] === '@' || attrs[a].value.includes('{{')){
					temp.add(currentNode);
					currentNode.sf$onlyAttribute = true;
					break;
				}
			}

			if(currentNode.childNodes.length !== 0)
				self.queuePreprocess(currentNode, extracting, collectOther, temp);
		}

		else if(currentNode.nodeType === 3){ // Text
			if(currentNode.textContent.trim().length === 0){
				if(currentNode.textContent.length === 0)
					currentNode.remove();
				else
					currentNode.textContent = currentNode.textContent.slice(0, 2);
				continue;
			}

			// The scan is from bottom to first index
			const enclosing = currentNode.textContent.indexOf('{[');
			if(enclosing !== -1)
				enclosedHTMLParse = false;
			else if(enclosedHTMLParse === true)
				continue;

			// Start enclosed if closing pattern was found
			const enclosed = currentNode.textContent.indexOf(']}');
			if(enclosed !== -1 && (enclosing === -1 || enclosing > enclosed)){ // avoid {[ ... ]}
				enclosedHTMLParse = true; // when ]} ...
				continue;
			}

			// Continue here when enclosed template {[...]} was skipped

			if(currentNode.textContent.includes('{{')){
				if(extracting === void 0){
					const theParent = currentNode.parentNode;

					// If it's not single/regular template
					if(currentNode.textContent.includes('{{@') || enclosing !== -1)
						temp.add(theParent); // get the element (from current text node)
					else temp.add(currentNode);

					if(theParent.sf$onlyAttribute !== void 0)
						delete theParent.sf$onlyAttribute;

					continue;
				}

				if(!temp.has(currentNode)){
					temp.add(currentNode);

					if(currentNode.parentNode.sf$onlyAttribute !== void 0)
						delete currentNode.parentNode.sf$onlyAttribute;
				}
			}
		}
	}

	return temp;
}

self.parsePreprocess = function(nodes, modelRef, modelKeysRegex){
	const binded = new WeakSet();

	for(let current of nodes){
		// Get reference for debugging
		processingElement = current;

		if(current.nodeType === 3 && binded.has(current.parentNode) === false){
			if(current.parentNode.tagName === 'SF-M'){
				// Auto wrap element if parent is 'SF-M'
				const replace = document.createElement('span');
				current.parentNode.insertBefore(replace, current);
				replace.appendChild(current);
			}

			self.bindElement(current.parentNode, modelRef, void 0, void 0, modelKeysRegex);
			binded.add(current.parentNode);
			continue;
		}

		// Create attribute template only because we're not going to process HTML content
		if(current.sf$onlyAttribute !== void 0){
			const preParsedRef = [];

			const template = Object.create(modelKeysRegex);
			template.parse = preParsedRef;
			template.modelRefRoot = {};
			template.modelRefRoot_path = [];

			const attrs = current.attributes;
			for (var i = 0; i < attrs.length; i++) {
				const attr = attrs[i];

				if(attr.value.includes('{{'))
					attr.value = dataParser(attr.value, null, template, modelRef, preParsedRef);
			}

			template.addresses = addressAttributes(current, template);
			toObserve.template = template;

			// Create as function
			for (var i = 0; i < preParsedRef.length; i++) {
				const ref = preParsedRef[i];

				if(ref.type === REF_DIRECT){
					toObserve.template.i = i;
					ref.data[0] = ref.data[0].replace(sfRegex.itemsObserve, toObserve);

					// Convert to function
					ref.get = modelScript(void 0, ref.data.shift());
					continue;
				}
			}

			delete toObserve.template.i;
			toObserve.template = void 0;

			revalidateTemplateRef(template, modelRef);

			const parsed = templateExec(preParsedRef, modelRef);
			const currentRef = [];
			parserForAttribute(current, template.addresses, null, modelRef, parsed, currentRef, void 0, template);

			// Save reference to element
			if(currentRef.length !== 0){
				currentRef.template = template;
				current.sf$elementReferences = currentRef;
			}

			self.bindElement(current, modelRef, template);

			delete current.sf$onlyAttribute;
			continue;
		}

		if(current.nodeType !== 3)
			self.bindElement(current, modelRef, void 0, void 0, modelKeysRegex);
	}
}

function initBindingInformation(modelRef){
	if(modelRef.sf$bindedKey !== void 0)
		return;

	// Element binding data
	Object.defineProperty(modelRef, 'sf$bindedKey', {
		configurable: true,
		writable:true,
		value:{}
	});
}

function revalidateTemplateRef(template, modelRef){
	revalidateBindingPath(template.modelRefRoot, template.modelRefRoot_path, modelRef);

	// for repeated list if exist
	if(template.modelRef_path !== void 0 && template.modelRef_path.length !== 0){
		template.modelRef_path.revalidate = true;
		revalidateBindingPath(template.modelRef, template.modelRef_path, modelRef);
	}
}

// This will affect syntheticTemplate validation on property observer
function revalidateBindingPath(refRoot, paths, modelRef){
	for (let i = 0; i < paths.length; i++) {
		const path = paths[i];
		const deep = deepProperty(modelRef, path.slice(0, -1));

		// We're not bind the native stuff
		if(path.includes('constructor')){
			for(var keys in refRoot){
				if(keys.includes('.constructor'))
					delete refRoot[keys];
			}

			for (var a = i+1; a < paths.length; a++) {
				if(paths[a].includes('constructor'))
					paths.splice(a--, 1);
			}

			paths.splice(i, 1);
			return;
		}

		// We can't verify it if not exist '-'
		if(deep === void 0)
			continue;

		// Decrease one level, maybe because from calling string/number manipulation function like .slice or .toFixed
		if(deep.constructor === String || deep.constructor === Number){
			// if it's taking index of string, then decrease two level
			if(path.length > 3 && path[path.length-2].constructor === Number)
				path.splice(path.length-2);
			else
				path.splice(path.length-1);

			// Remove other similar paths
			that:for (var a = i+1; a < paths.length; a++) {
				const check = paths[a];
				for (let z = 0; z < path.length; z++) {
					if(check[z] !== path[z])
						continue that;
				}

				paths.splice(a--, 1);
			}

			// Replace the property, we need to search it and collect the index
			var str = stringifyPropertyPath(path);
			const collect = [];

			for(var keys in refRoot){
				if(keys.indexOf(str) === 0){
					const rootIndex = refRoot[keys];
					delete refRoot[keys];

					for (var a = 0; a < rootIndex.length; a++) {
						if(collect.includes(rootIndex[a]) === false)
							collect.push(rootIndex[a]);
					}
				}
			}

			refRoot[str] = collect;
		}
		// We're not binding the native stuff
		else if((deep.constructor === Array && path[path.length-1] === 'length') || deep.constructor === Function){
			// Delete the property
			var str = stringifyPropertyPath(path);
			for(var keys in refRoot){
				if(keys.indexOf(str) === 0)
					delete refRoot[keys];
			}
		}
	}
}
// Info: repeated list that using root binding or using property from root model (not the list property)
// will be slower on array operation because it's managing possible memory leak

// Known bugs: using keys for repeated list won't changed when refreshed
// - we also need to support bind into array key if specified

// var warnUnsupport = true;
const repeatedListBinding = internal.model.repeatedListBinding = function(elements, modelRef, namespace, modelKeysRegex){
	let element, script;

	for (let i = 0; i < elements.length; i++) {
		if(elements[i].getAttribute === void 0){
			element = elements[i].el;
			script = elements[i].rule;
		}
		else{
			element = elements[i];

			// ToDo: find the culprit why we need to check this
			if(!element.hasAttribute('sf-repeat-this'))
				continue;

			script = element.getAttribute('sf-repeat-this');
			element.removeAttribute('sf-repeat-this');
		}

		element.sf$componentIgnore = true;

		let pattern = script.match(sfRegex.repeatedList);
		if(pattern === null){
			console.error("'", script, "' should match the pattern like `key,val in list`");
			continue;
		}
		pattern = pattern.slice(1);

		if(pattern[0].includes(','))
			pattern[0] = pattern[0].split(' ').join('').split(',');

		let target = modelRef[pattern[1]];
		if(target === void 0){
			const isDeep = parsePropertyPath(pattern[1]);
			if(isDeep.length !== 1){
				pattern[1] = isDeep;
				target = deepProperty(modelRef, isDeep);

				// Cache deep
				if(modelRef.sf$internal)
					modelRef.sf$internal[isDeep.slice(0, -1).join('%$')] = true;
			}

			if(target === void 0)
				modelRef[pattern[1]] = target = [];
		}
		else{
			// Enable element binding
			if(modelRef.sf$bindedKey === void 0)
				initBindingInformation(modelRef);

			modelRef.sf$bindedKey[pattern[1]] = true;
		}

		const { constructor } = target;

		if(constructor === Array || constructor === RepeatedList){
			RepeatedList.construct(modelRef, element, pattern, element.parentNode, namespace, modelKeysRegex);
			continue;
		}

		if(constructor === Object || constructor === RepeatedProperty){
			RepeatedProperty.construct(modelRef, element, pattern, element.parentNode, namespace, modelKeysRegex);
			continue;
		}

		console.error(pattern[1], target, "should be an array or object but got", constructor);
	}
}

function prepareRepeated(modelRef, element, pattern, parentNode, namespace, modelKeysRegex){
	let callback, prop = pattern[1], targetDeep;

	if(prop.constructor !== Array)
		targetDeep = modelRef;
	else{
		targetDeep = deepProperty(modelRef, prop.slice(0, -1));
		prop = prop[prop.length - 1];
	}

	callback = targetDeep[`on$${prop}`] || {};

	const compTemplate = (namespace || sf.component).registered[element.tagName.toLowerCase()];
	if(compTemplate !== void 0 && compTemplate[3] === false && element.childNodes.length !== 0)
		compTemplate[3] = element;

	const isComponent = compTemplate !== void 0 ? compTemplate[1] : false;
	const EM = new ElementManipulator();

	if(this.$EM === void 0){
		hiddenProperty(this, '$EM', EM, true);
		Object.defineProperty(targetDeep, `on$${prop}`, {
			configurable: true,
			get(){
				return callback;
			},
			set(val){
				Object.assign(callback, val);
			}
		});
	}
	else if(this.$EM.constructor === ElementManipulatorProxy)
		this.$EM.list.push(EM);
	else{
		const newList = [this.$EM, EM];
		this.$EM = new ElementManipulatorProxy();
		this.$EM.list = newList;
	}

	let mask = pattern[0], uniqPattern;
	if(mask.constructor === Array){
		uniqPattern = mask[0];
		mask = mask.pop();
	}

	EM.asScope = void 0;

	let template;
	if(!isComponent){
		// Get reference for debugging
		processingElement = element;

		let container;
		if(element.namespaceURI === 'http://www.w3.org/2000/svg' && element.tagName !== 'SVG')
			container = 'svg';

		template = self.extractPreprocess(element, mask, modelRef, container, modelKeysRegex, true, uniqPattern);
		template.bindList = this;
	}
	else if(element.hasAttribute('sf-as-scope'))
		EM.asScope = true;

	EM.template = isComponent || template;
	EM.list = this;
	EM.parentNode = parentNode;
	EM.modelRef = modelRef;
	EM.isComponent = !!isComponent;
	EM.namespace = namespace;
	EM.template.mask = mask;
	EM.elementRef = new WeakMap();
	EM.callback = callback; // Update callback
	parentNode.$EM = EM;

	if(uniqPattern !== void 0)
		EM.template.uniqPattern = uniqPattern;

	const { nextSibling } = element;
	element.remove();

	// check if alone
	if(parentNode.childNodes.length <= 1 || parentNode.textContent.trim().length === 0)
		return true;

	const that = this;
	return function(){
		EM.bound_end = document.createComment('');
		parentNode.insertBefore(EM.bound_end, nextSibling);

		if(that.length !== void 0)
			EM.elements = new Array(that.length);
		else EM.elements = [];

		// Output to real DOM if not being used for virtual list
		injectArrayElements(EM, parentNode, EM.bound_end, that, modelRef, parentNode);
	}
}

class RepeatedProperty{ // extends Object
	static construct(modelRef, element, pattern, parentNode, namespace, modelKeysRegex){
		let prop = pattern[1];
		const that = prop.constructor === String ? modelRef[prop] : deepProperty(modelRef, prop);

		// Initialize property once
		if(that.constructor !== RepeatedProperty){
			// Hide property that have $
			for(let k in that){
				if(k.includes('$'))
					hiddenProperty(that, k, that[k], true);
			}

			hiddenProperty(that, '_list', Object.keys(that));

			let target;
			if(prop.constructor !== Array)
				target = modelRef;
			else{
				target = deepProperty(modelRef, prop.slice(0, -1));
				prop = prop[prop.length-1];
			}

			Object.setPrototypeOf(that, RepeatedProperty.prototype);
			Object.defineProperty(target, prop, {
				enumerable: true,
				configurable: true,
				get(){
					return that;
				},
				set(val){
					const olds = that._list;
					const news = Object.keys(val);

					// Assign if keys order was similar
					for (var a = 0; a < olds.length; a++) {
						if(olds[a] === news[a]){
							that[olds[a]] = val[olds[a]];
							continue;
						}
						break;
					}

					// Return if all new value has been assigned
					if(a === news.length && olds[a] === void 0)
						return;

					for (var i = a; i < olds.length; i++)
						that.delete(olds[i]);

					for (var i = a; i < news.length; i++)
						that.set(news[i], val[news[i]]);

					that._list = news;
				}
			});
		}

		const alone = prepareRepeated.apply(that, arguments);
		const EM = that.$EM.constructor === ElementManipulatorProxy ? that.$EM.list[that.$EM.list.length-1] : that.$EM;

		// Proxy known property
		for(let key in that)
			ProxyProperty(that, key, true);

		if(alone === true){
			// Output to real DOM if not being used for virtual list
			EM.parentChilds = parentNode.children;
			injectArrayElements(EM, parentNode, void 0, that, modelRef, parentNode, namespace);
		}
		else alone();
	}

	$el(selector){
		const { $EM } = this;
		if($EM.constructor === ElementManipulatorProxy)
			return $EM.$el(selector)
		return $(queryElements(($EM.parentChilds || $EM.elements), selector));
	}

	getElement(prop){
		let { $EM } = this;
		if($EM.constructor === ElementManipulatorProxy)
			$EM = $EM.list[0];

		// If single RepeatedElement instance
		if(typeof this[prop] === 'object')
			return $EM.elementRef.get(this[prop]);
		return ($EM.parentChilds || $EM.elements)[this._list.indexOf(prop)];
	}

	// Return array
	getElements(index){
		if(this.$EM.constructor === ElementManipulatorProxy)
			return this.$EM.getElement_RP(this, index);

		return [this.getElement(index)];
	}

	refresh(){
		if(this.$EM.constructor === ElementManipulatorProxy)
			return this.$EM.refresh_RP(this);

		const elemList = (this.$EM.parentChilds || this.$EM.elements);
		if(elemList === void 0)
			return;

		// If single RepeatedElement instance
		const list = this._list;
		for (let i = 0; i < list.length; i++) {
			const elem = elemList[i];

			if(this[list[i]] !== elem.model){
				const newElem = this.$EM.createElement(list[i]);
				this.$EM.parentNode.replaceChild(newElem, elem);

				if(this.$EM.elements !== void 0)
					elemList[i] = newElem;
			}
		}
	}
}

// Only for Object or RepeatedProperty
sf.set = function(obj, prop, val){
	if(obj[prop] === val)
		return;

	if(obj.$EM === void 0){
		obj[prop] = val;
		return;
	}

	if(obj[prop] === void 0){
		obj[prop] = val;
		ProxyProperty(obj, prop, false);

		obj.$EM.append(prop);
		obj._list.push(prop);
	}
}

sf.delete = function(obj, prop){
	if(obj.$EM === void 0){
		delete obj[prop];
		return;
	}

	const i = obj._list.indexOf(prop);
	if(i === -1)
		return;

	obj.$EM.remove(i);
	delete obj[prop];

	obj._list.splice(i, 1);
}

function ProxyProperty(obj, prop, force){
	if(force || Object.getOwnPropertyDescriptor(obj, prop).set === void 0){
		let temp = obj[prop];

		Object.defineProperty(obj, prop, {
			configurable:true,
			enumerable:true,
			get(){return temp},
			set(val){
				temp = val;
				obj.refresh(prop);
			}
		});
	}
}

// This is called only once when RepeatedProperty/RepeatedList is initializing
// So we don't need to use cache
function injectArrayElements(EM, tempDOM, beforeChild, that, modelRef, parentNode, namespace){
	let temp,
		{ isComponent,
		template } = EM;

	if(that.constructor === RepeatedProperty){
		temp = that;
		that = Object.values(that);
	}

	const len = that.length;
	let elem;
	for (var i = 0; i < len; i++) {
		if(isComponent)
			elem = new template(that[i], namespace, EM.asScope);
		else{
			if(temp === void 0)
				elem = templateParser(template, that[i], false, modelRef, parentNode, void 0, template.uniqPattern && i);
			else
				elem = templateParser(template, that[i], false, modelRef, parentNode, void 0, template.uniqPattern && temp._list[i]);
		}

		if(typeof that[i] === "object"){
			if(isComponent === false)
				self.bindElement(elem, modelRef, template, that[i]);

			EM.elementRef.set(that[i], elem);
		}

		if(beforeChild === void 0)
			tempDOM.appendChild(elem);
		else if(beforeChild === true) // Virtual Scroll
			EM.elements[i] = elem;
		else{
			EM.elements[i] = elem;
			tempDOM.insertBefore(elem, beforeChild);
		}
	}

	if(temp !== void 0){
		var i = 0;
		for(let keys in temp)
			temp[keys] = that[i++];
	}
}

class RepeatedList extends Array{
	static construct(modelRef, element, pattern, parentNode, namespace, modelKeysRegex){
		let prop = pattern[1];
		const that = prop.constructor === String ? modelRef[prop] : deepProperty(modelRef, prop);

		// Initialize property once
		if(that.constructor !== RepeatedList){
			let target;
			if(prop.constructor !== Array)
				target = modelRef;
			else{
				target = deepProperty(modelRef, prop.slice(0, -1));
				prop = prop[prop.length-1];
			}

			Object.setPrototypeOf(that, RepeatedList.prototype);
			Object.defineProperty(target, prop, {
				enumerable: true,
				configurable: true,
				get(){
					return that;
				},
				set(val){
					if(val.length === 0)
						that.splice(0);
					else that.remake(val, true);
				}
			});
		}

		const alone = prepareRepeated.apply(that, arguments);
		const EM = that.$EM.constructor === ElementManipulatorProxy ? that.$EM.list[that.$EM.list.length-1] : that.$EM;
		const { template } = EM;

		if(parentNode.classList.contains('sf-virtual-list')){
			hiddenProperty(that, '$virtual', new VirtualScroll(EM));

			if(alone !== true)
				console.warn("Virtual list was initialized when the container has another child that was not sf-repeated element.", parentNode);

			EM.elements = new Array(that.length);
			parentNode.$VSM = EM.$VSM = new VirtualScrollManipulator(parentNode, EM, template.html);

			// Put DOM element to the EM.elements only, and inject to the real DOM when ready
			injectArrayElements(EM, parentNode, true, that, modelRef, parentNode, namespace);
			EM.$VSM.startInjection();
		}
		else if(alone === true){
			// Output to real DOM if not being used for virtual list
			EM.parentChilds = parentNode.children;
			injectArrayElements(EM, parentNode, void 0, that, modelRef, parentNode, namespace);
		}
		else alone();

		// Wait for scroll plugin initialization
		setTimeout(function(){
			const scroller = internal.findScrollerElement(parentNode);
			if(scroller === null) return;

			internal.addScrollerStyle();

			const computed = getComputedStyle(scroller);
			if(computed.backfaceVisibility === 'hidden' || computed.overflow.includes('hidden'))
				return;

			scroller.classList.add('sf-scroll-element');
		}, 1000);
	}

	$el(selector){
		const { $EM } = this;
		if($EM.constructor === ElementManipulatorProxy)
			return $EM.$el(selector)
		return $(queryElements(($EM.parentChilds || $EM.elements), selector));
	}

	pop(){
		this.$EM.remove(this.length - 1);
		return Array.prototype.pop.apply(this, arguments);
	}

	push(){
		const lastLength = this.length;
		Array.prototype.push.apply(this, arguments);

		if(arguments.length === 1)
			this.$EM.append(lastLength);
		else this.$EM.hardRefresh(lastLength);

		return this.length;
	}

	splice(){
		if(arguments[0] === 0 && arguments[1] === void 0){
			this.$EM.clear(0);
			return Array.prototype.splice.apply(this, arguments);
		}

		const lastLength = this.length;
		const ret = Array.prototype.splice.apply(this, arguments);

		// Removing data
		let real = arguments[0];
		if(real < 0) real = lastLength + real;

		let limit = arguments[1];
		if(!limit && limit !== 0) limit = this.length;

		for (var i = limit - 1; i >= 0; i--)
			this.$EM.remove(real + i);

		if(arguments.length >= 3){ // Inserting data
			limit = arguments.length - 2;

			// Trim the index if more than length
			if(real >= this.length)
				real = this.length - 1;

			for (var i = 0; i < limit; i++)
				this.$EM.insertAfter(real + i);
		}

		return ret;
	}

	shift(){
		const ret = Array.prototype.shift.apply(this, arguments);

		this.$EM.remove(0);
		return ret;
	}

	unshift(){
		Array.prototype.unshift.apply(this, arguments);

		if(arguments.length === 1)
			this.$EM.prepend(0);

		else{
			for (let i = arguments.length - 1; i >= 0; i--)
				this.$EM.prepend(i);
		}

		return this.slice(0, arguments.length);
	}

	constructor(arr){return new Array(arr)}
	assign(fromIndex, withArray, removes, putLast){
		if(fromIndex.constructor !== Number){
			if(removes === void 0 || removes.constructor === Boolean)
				putLast = removes; // true=last index, false=first, undefined=depends

			if(withArray !== void 0 && withArray.constructor === Object)
				removes = withArray;

			withArray = fromIndex;
			fromIndex = 0;
		}

		if(withArray.constructor !== Array)
			withArray = [withArray];

		if(removes !== void 0){
			if(removes.constructor === Object){
				const temp = {};

				for(let key in removes){
					if(key.slice(-1) === ']'){
						const k = key.split('[');
						switch(k[1]){
							case "!]":
							if(temp.b === void 0) temp.b = [];
							temp.b.push({key:key[0], val:removes[key]});
							break;
							case "<]":
							if(temp.c === void 0) temp.c = [];
							temp.c.push({key:key[0], val:removes[key]});
							break;
							case "<=]":
							if(temp.d === void 0) temp.d = [];
							temp.d.push({key:key[0], val:removes[key]});
							break;
							case ">]":
							if(temp.e === void 0) temp.e = [];
							temp.e.push({key:key[0], val:removes[key]});
							break;
							case ">=]":
							if(temp.f === void 0) temp.f = [];
							temp.f.push({key:key[0], val:removes[key]});
							break;
							default:
							if(temp.a === void 0) temp.a = [];
							temp.a.push({key:key[0], val:removes[key]});
							break;
						}
					}
					else{
						if(temp.a === void 0) temp.a = [];
						temp.a.push({key:key[0], val:removes[key]});
					}
				}

				removes = temp;
			}

			let processed;
			if(putLast === true)
				processed = new WeakSet();

			that:for(var i = fromIndex; i < this.length; i++){
				if(putLast === true && processed.has(this[i]))
					break;

				if(removes.constructor === Object){
					const temp1 = this[i];
					if(removes.a !== void 0){ // ===
						for(var z=0, n=removes.a.length; z < n; z++){
							var temp2 = removes.a[z];
							if(temp1[temp2.key] !== temp2.val)
								continue that;
						}
					}
					if(removes.b !== void 0){ // !==
						for(var z=0, n=removes.b.length; z < n; z++){
							var temp2 = removes.b[z];
							if(temp1[temp2.key] === temp2.val)
								continue that;
						}
					}
					if(removes.c !== void 0){ // <
						for(var z=0, n=removes.c.length; z < n; z++){
							var temp2 = removes.c[z];
							if(temp1[temp2.key] >= temp2.val)
								continue that;
						}
					}
					if(removes.d !== void 0){ // <=
						for(var z=0, n=removes.d.length; z < n; z++){
							var temp2 = removes.d[z];
							if(temp1[temp2.key] > temp2.val)
								continue that;
						}
					}
					if(removes.e !== void 0){ // >
						for(var z=0, n=removes.e.length; z < n; z++){
							var temp2 = removes.e[z];
							if(temp1[temp2.key] <= temp2.val)
								continue that;
						}
					}
					if(removes.f !== void 0){ // >=
						for(var z=0, n=removes.f.length; z < n; z++){
							var temp2 = removes.f[z];
							if(temp1[temp2.key] < temp2.val)
								continue that;
						}
					}
				}
				else if(!removes(this[i]))
					continue;

				if(withArray.length === 0){
					this.splice(i--, 1);
					continue;
				}

				const current = withArray.shift();
				if(this[i] !== current)
					Object.assign(this[i], current);

				if(putLast === true){
					processed.add(this[i]);
					this.push(this.splice(i--, 1)[0]);
				}
				else if(putLast === false)
					this.unshift(this.splice(i, 1)[0]);
			}

			if(withArray.length !== 0){
				if(putLast === false)
					this.unshift.apply(this, withArray);
				else
					this.push.apply(this, withArray);
			}

			return this;
		}
		else{
			for(var i = 0; i < withArray.length; i++){
				if(i === this.length)
					break;

				if(this[i + fromIndex] !== withArray[i])
					Object.assign(this[i + fromIndex], withArray[i]);
			}
		}

		if(withArray.length === this.length || fromIndex !== 0)
			return this;

		const lastLength = this.length;
		if(withArray.length > this.length){
			Array.prototype.push.apply(this, withArray.slice(this.length));
			this.$EM.hardRefresh(lastLength);
			return this;
		}

		if(withArray.length < this.length){
			Array.prototype.splice.call(this, withArray.length);
			this.$EM.removeRange(withArray.length, lastLength);
			return this;
		}
	}

	remake(newList, atMiddle){
		const lastLength = this.length;

		// Check if item has same reference
		if(newList.length >= lastLength && lastLength !== 0){
			let matchLeft = lastLength;

			for (var i = 0; i < lastLength; i++) {
				if(newList[i] === this[i]){
					matchLeft--;
					continue;
				}
				break;
			}

			// Add new element at the end
			if(matchLeft === 0){
				if(newList.length === lastLength) return;

				var temp = newList.slice(lastLength);
				temp.unshift(lastLength, 0);
				this.splice.apply(this, temp);
				return;
			}

			// Add new element at the middle
			else if(matchLeft !== lastLength){
				if(atMiddle === true){
					var temp = newList.slice(i);
					temp.unshift(i, lastLength - i);
					Array.prototype.splice.apply(this, temp);

					this.refresh(i, lastLength);
				}
				return;
			}
		}

		// Build from zero
		if(lastLength === 0){
			Array.prototype.push.apply(this, arguments[0]);
			this.$EM.hardRefresh(0);
			return;
		}

		// Clear all items and merge the new one
		var temp = [0, lastLength];
		Array.prototype.push.apply(temp, arguments[0]);
		Array.prototype.splice.apply(this, temp);

		// Rebuild all element
		if(arguments[1] !== true){
			this.$EM.clear(0);
			this.$EM.hardRefresh(0);
		}

		// Reuse some element
		else{
			// Clear unused element if current array < last array
			if(this.length < lastLength)
				this.$EM.removeRange(this.length, lastLength);

			// And start refreshing
			this.$EM.hardRefresh(0, this.length);
		}

		return this;
	}

	swap(i, o){
		if(i === o) return;
		this.$EM.swap(i, o);
		const temp = this[i];
		this[i] = this[o];
		this[o] = temp;
	}

	move(from, to, count){
		if(from === to) return;

		if(count === void 0)
			count = 1;

		this.$EM.move(from, to, count);

		const temp = Array.prototype.splice.call(this, from, count);
		temp.unshift(to, 0);
		Array.prototype.splice.apply(this, temp);
	}

	// Return single element from first $EM
	getElement(index){
		let { $EM } = this;
		if($EM.constructor === ElementManipulatorProxy)
			$EM = $EM.list[0];

		// If single RepeatedElement instance
		if(index.constructor === Number){
			if(typeof this[index] !== 'object')
				return ($EM.parentChilds || $EM.elements)[index];

			return $EM.elementRef.get(this[index]);
		}

		return $EM.elementRef.get(index);
	}

	// Return array
	getElements(index){
		if(this.$EM.constructor === ElementManipulatorProxy)
			return this.$EM.getElement_RL(this, index);

		return [this.getElement(index)];
	}

	indexOf(item){
		if(item.children !== void 0 && item.children.constructor === HTMLCollection){
			if(!item.sf$elementReferences || !item.sf$elementReferences.template.bindList)
				item = findBindListElement(item);

			if(item === null)
				return -1;

			arguments[0] = item.model;
		}

		return Array.prototype.indexOf.apply(this, arguments);
	}

	reverse(){
		this.$EM.reverse();
		Array.prototype.reverse.call(this);
	}

	refresh(index, length){
		if(index === void 0 || index.constructor === String){
			index = 0;
			({ length } = this);
		}
		else if(length === void 0) length = index + 1;
		else if(length < 0) length = this.length + length;
		else length += index;

		// Trim length
		const overflow = this.length - length;
		if(overflow < 0) length = length + overflow;

		if(this.$EM.constructor === ElementManipulatorProxy)
			var elems = this.$EM.list[0].parentChilds || this.$EM.list[0].elements;
		else
			var elems = this.$EM.parentChilds || this.$EM.elements;

		for (let i = index; i < length; i++) {
			// Create element if not exist
			if(elems[i] === void 0){
				this.$EM.hardRefresh(i);
				return;
			}

			if(this.$EM.constructor === ElementManipulatorProxy)
				var oldElem = this.$EM.list[0].elementRef.get(this[i]);
			else
				var oldElem = this.$EM.elementRef.get(this[i]);

			if(oldElem === void 0 || elems[i].model !== oldElem.model)
				this.$EM.update(i, 1);
		}
	}
}

class ElementManipulator{
	createElement(index){
		const item = this.list[index];
		if(item === void 0) return;

		const { template } = this;
		let temp = this.elementRef && this.elementRef.get(item);

		if(temp !== void 0){
			if(temp.model.$el === void 0){
				// This is not a component, lets check if all property are equal
				if(compareObject(temp.model, item) === false){
					temp = templateParser(template, item, false, this.modelRef, this.parentNode, void 0, template.uniqPattern && index);

					if(typeof item === "object"){
						if(this.isComponent === false)
							self.bindElement(temp, this.modelRef, template, item);

						if(this.elementRef !== void 0)
							this.elementRef.set(item, temp);
					}
				}
				else if(temp.sf$bindedBackup !== void 0){
					RE_restoreBindedList(this.modelRef, temp.sf$bindedBackup);
					temp.sf$bindedBackup = void 0;
				}
			}

			if(this.$VSM) this.$VSM.newElementInit(temp, index-1);
			return temp;
		}

		if(template.constructor === Function)
			temp = new template(item, this.namespace, this.asScope);
		else temp = templateParser(template, item, false, this.modelRef, this.parentNode, void 0, template.uniqPattern && index);

		if(typeof item === "object"){
			if(this.isComponent === false)
				self.bindElement(temp, this.modelRef, template, item);

			if(this.elementRef !== void 0)
				this.elementRef.set(item, temp);
		}

		if(this.$VSM) this.$VSM.newElementInit(temp, index-1);
		return temp;
	}

	// Recreate the item element after the index
	hardRefresh(index){
		const { list } = this;
		const exist = this.parentChilds || this.elements;

		if(this.template.modelRefRoot_path && this.template.modelRefRoot_path.length !== 0)
			this.clearBinding(exist, index);

		if(index === 0 && this.$VSM === void 0 && this.bound_end === void 0)
			this.parentNode.textContent = '';
		else{
			// Clear siblings after the index
			if(this.parentChilds){
				for (var i = index, n = exist.length; i < n; i++) {
					exist[index].remove();
				}
			}
			else for (var i = index; i < exist.length; i++) {
				exist[i].remove();
			}

			if(this.elements !== void 0)
				exist.length = index;
		}

		if(this.elements !== void 0)
			exist.length = list.length;

		for (var i = index; i < list.length; i++) {
			const ref = list[i];
			let temp = this.elementRef.get(ref);

			if(temp === void 0){
				if(this.isComponent)
					temp = new this.template(ref, this.namespace, this.asScope);
				else
					temp = templateParser(this.template, ref, false, this.modelRef, this.parentNode, void 0, this.template.uniqPattern && i);

				if(typeof ref === "object"){
					if(this.isComponent === false)
						self.bindElement(temp, this.modelRef, this.template, ref);

					this.elementRef.set(ref, temp);

					if(this.elements !== void 0)
						exist[i] = temp;
				}
			}
			else if(temp.model.$el === void 0){
				// This is not a component, lets check if all property are equal
				if(compareObject(temp.model, ref) === false){
					temp = templateParser(this.template, ref, false, this.modelRef, this.parentNode, void 0, this.template.uniqPattern && i);

					if(typeof ref === "object"){
						if(this.isComponent === false)
							self.bindElement(temp, this.modelRef, this.template, ref);

						this.elementRef.set(ref, temp);

						if(this.elements !== void 0)
							exist[i] = temp;
					}
				}
				else if(temp.sf$bindedBackup !== void 0){
					RE_restoreBindedList(this.modelRef, temp.sf$bindedBackup);
					temp.sf$bindedBackup = void 0;
				}
			}

			if(this.$VSM === void 0)
				this.parentNode.appendChild(temp);
			else{
				exist[i] = temp;
				this.$VSM.newElementInit(temp, i-1);
			}
		}

		if(this.$VSM) this.$VSM.hardRefresh(index);
	}

	update(index, other){
		const exist = this.parentChilds || this.elements;
		const { list } = this;
		const { template } = this;

		if(index === void 0){
			index = 0;
			other = list.length;
		}
		else if(other === void 0) other = index + 1;
		else if(other < 0) other = list.length + other;
		else other += index;

		// Trim length
		const overflow = list.length - other;
		if(overflow < 0) other = other + overflow;

		if(this.template.modelRefRoot_path && this.template.modelRefRoot_path.length !== 0)
			this.clearBinding(exist, index, other);

		for (let i = index; i < other; i++) {
			const oldChild = exist[i];
			if(oldChild === void 0 || list[i] === void 0)
				break;

			const ref = list[i];
			let temp = this.elementRef.get(ref);

			if(temp === void 0){
				if(this.isComponent)
					temp = new template(ref, this.namespace, this.asScope);
				else
					temp = templateParser(template, ref, false, this.modelRef, this.parentNode, void 0, template.uniqPattern && i);

				if(typeof ref === "object"){
					if(this.isComponent === false)
						self.bindElement(temp, this.modelRef, template, ref);

					this.elementRef.set(ref, temp);

					if(this.elements != void 0)
						exist[i] = temp;
				}
			}
			else if(temp.model.$el === void 0){
				// This is not a component, lets check if all property are equal
				if(compareObject(temp.model, ref) === false){
					temp = templateParser(template, ref, false, this.modelRef, this.parentNode, void 0, template.uniqPattern && i);

					if(typeof ref === "object"){
						if(this.isComponent === false)
							self.bindElement(temp, this.modelRef, template, ref);

						this.elementRef.set(ref, temp);

						if(this.elements != void 0)
							exist[i] = temp;
					}
				}
				else if(temp.sf$bindedBackup !== void 0){
					RE_restoreBindedList(this.modelRef, temp.sf$bindedBackup);
					temp.sf$bindedBackup = void 0;
				}
			}

			if(this.$VSM){
				this.$VSM.newElementInit(temp, i-1);
				this.$VSM.update(i, temp);
				continue;
			}

			this.parentNode.replaceChild(temp, oldChild);

			if(this.elements != void 0)
				exist[i] = temp;

			if(this.callback.update)
				this.callback.update(temp, 'replace');
		}
	}

	move(from, to, count){
		const exist = this.parentChilds || this.elements;

		const overflow = this.list.length - from - count;
		if(overflow < 0)
			count += overflow;

		const vDOM = new Array(count);
		for (var i = 0; i < count; i++)
			(vDOM[i] = exist[from + i]).remove();

		if(this.$VSM === void 0){
			const nextSibling = exist[to] || null;

			// Move to defined index
			for (var i = 0; i < count; i++) {
				this.parentNode.insertBefore(vDOM[i], nextSibling);

				if(this.callback.update)
					this.callback.update(vDOM[i], 'move');
			}
		}
		else this.$VSM.move(from, to, count, vDOM);

		if(this.elements !== void 0){
			exist.splice(from, count);
			vDOM.unshift(from, 0);
			exist.splice.apply(exist, vDOM);
		}
	}

	swap(index, other){
		const exist = this.parentChilds || this.elements;

		const ii=index, oo=other;
		if(index > other){
			const index_a = exist[other];
			other = exist[index];
			index = index_a;
		} else {
			index = exist[index];
			other = exist[other];
		}

		if(this.elements !== void 0){
			const temp = exist[ii];
			exist[ii] = exist[oo];
			exist[oo] = exist[ii];
		}

		if(this.$VSM === void 0){
			const other_sibling = other.nextSibling;
			const other_parent = other.parentNode;
			index.parentNode.insertBefore(other, index.nextSibling);
			other_parent.insertBefore(index, other_sibling);
		}
		else this.$VSM.swap(ii, oo);

		if(this.callback.update){
			this.callback.update(exist[other], 'swap');
			this.callback.update(exist[index], 'swap');
		}
	}

	remove(index){
		const exist = this.parentChilds || this.elements;

		if(this.template.modelRefRoot_path && this.template.modelRefRoot_path.length !== 0)
			this.clearBinding(exist, index, index+1);

		if(exist[index]){
			const currentEl = exist[index];

			if(this.callback.remove){
				let currentRemoved = false;
				const startRemove = function(){
					if(currentRemoved) return;
					currentRemoved = true;

					currentEl.remove();
				};

				// Auto remove if return false
				if(!this.callback.remove(currentEl, startRemove))
					startRemove();
			}

			// Auto remove if no callback
			else currentEl.remove();

			if(this.$VSM) this.$VSM.remove(index);

			if(this.elements !== void 0)
				exist.splice(index, 1);
		}
	}

	removeRange(index, other){
		const exist = this.parentChilds || this.elements;

		for (let i = index; i < other; i++)
			exist[index].remove();

		if(this.template.modelRefRoot_path && this.template.modelRefRoot_path.length !== 0)
			this.clearBinding(exist, index, other);

		if(this.$VSM)
			this.$VSM.removeRange(index, other);
		else if(this.elements !== void 0)
			exist.splice(index, other-index);
	}

	clear(){
		if(this.template.modelRefRoot_path && this.template.modelRefRoot_path.length !== 0)
			this.clearBinding(this.parentChilds || this.elements, 0);

		this.parentNode.textContent = '';

		if(this.$VSM !== void 0)
			this.$VSM.clear();

		if(this.elements !== void 0)
			this.elements.length = 0;
	}

	insertAfter(index){
		const exist = this.parentChilds || this.elements;
		const temp = this.createElement(index);

		if(this.$VSM === void 0){
			if(exist.length === 0)
				this.parentNode.insertBefore(temp, this.parentNode.lastElementChild);
			else{
				const referenceNode = exist[index-1];
				referenceNode.parentNode.insertBefore(temp, referenceNode.nextSibling);
			}
		}

		if(this.elements !== void 0)
			exist.splice(index-1, 0, temp);

		if(this.$VSM) this.$VSM.insertAfter(index);

		if(this.callback.create)
			this.callback.create(temp);
	}

	prepend(index){
		const exist = this.parentChilds || this.elements;
		const temp = this.createElement(index);

		if(this.$VSM === void 0){
			const referenceNode = exist[0];
			if(referenceNode !== void 0){
				referenceNode.parentNode.insertBefore(temp, referenceNode);

				if(this.callback.create)
					this.callback.create(temp);
			}
			else this.parentNode.insertBefore(temp, this.parentNode.lastElementChild);
		}

		if(this.elements !== void 0)
			exist.unshift(temp);

		if(this.$VSM) this.$VSM.prepend(index);
	}

	append(index){
		const exist = this.parentChilds || this.elements;
		const temp = this.createElement(index);

		if(this.elements !== void 0)
			exist.push(temp);

		if(this.$VSM === void 0){
			if(this.bound_end !== void 0)
				this.parentNode.insertBefore(temp, this.bound_end);
			else
				this.parentNode.appendChild(temp);
		}
		else this.$VSM.append(index);

		if(this.callback.create)
			this.callback.create(temp);
	}

	reverse(){
		if(this.parentChilds !== void 0){
			const len = this.parentChilds.length;
			if(len === 0)
				return;

			const beforeChild = this.parentChilds[0];
			for (var i = 1; i < len; i++) {
				this.parentNode.insertBefore(this.parentNode.lastElementChild, beforeChild);
			}
		}
		else{
			const elems = this.elements;
			elems.reverse();

			if(this.$VSM)
				return this.$VSM.reverse();

			if(this.bound_end === void 0)
				for (var i = 0; i < elems.length; i++)
					this.parentNode.appendChild(elems[i]);
			else
				for (var i = 0; i < elems.length; i++)
					this.parentNode.insertBefore(elems[i], this.bound_end);
		}
	}

	clearBinding(elemList, from, to){
		if(to === void 0)
			to = this.list.length;

		const modelRoot = this.modelRef;
		const binded = this.template.modelRefRoot_path;

		if(elemList.constructor !== Array){
			// Loop for every element between range first (important)
			for (var i = from; i < to; i++) {
				var elem = elemList.item(i);

				// Loop for any related property
				for (var a = binded.length-1; a >= 0; a--) {
					var bindList = RE_getBindedList(modelRoot, binded[a]);
					if(bindList === void 0)
						continue;

					for (var z = bindList.length-1; z >= 0; z--) {
						if(bindList[z].element === elem){
							if(elem.sf$bindedBackup === void 0)
								elem.sf$bindedBackup = [];

							elem.sf$bindedBackup.push([binded[a], bindList.splice(z, 1)[0]]);
						}
					}
				}
			}
			return;
		}

		// Loop for any related property
		for (var a = binded.length-1; a >= 0; a--) {
			var bindList = RE_getBindedList(modelRoot, binded[a]);
			if(bindList === void 0)
				continue;

			for (var z = bindList.length-1; z >= 0; z--) {
				var i = elemList.indexOf(bindList[z].element);

				// Is between range?
				if(i === -1 || i < from ||  i >= to)
					continue;

				var elem = bindList[z].element;
				if(elem.sf$bindedBackup === void 0)
					elem.sf$bindedBackup = [];

				elem.sf$bindedBackup.push([binded[a], bindList.splice(z, 1)[0]]);
			}
		}
	}
}

class ElementManipulatorProxy{
	refresh_RP(instance){
		const { list } = this;
		const keys = instance._list;
		for (let i = 0; i < list.length; i++) {
			const EM = list[i];
			const elemList = (EM.parentChilds || EM.elements);

			if(elemList === void 0)
				continue;

			for (let a = 0; a < keys.length; a++) {
				const elem = elemList[a];

				if(elem === void 0){
					EM.append(keys[a]);
					continue;
				}

				if(instance[keys[a]] !== elem.model){
					const newElem = EM.createElement(keys[a]);
					EM.parentNode.replaceChild(newElem, elem);

					if(EM.elements !== void 0)
						elemList[a] = newElem;
				}
			}
		}
	}
	getElement_RP(instance, prop){
		const { list } = this;
		const keys = instance._list;

		const got = [];
		for (let i = 0; i < list.length; i++) {
			let val;
			if(typeof this[prop] === 'object')
				val = list[i].elementRef.get(instance[prop]);
			else
				val = (list[i].parentChilds || list[i].elements)[keys.indexOf(prop)];

			if(val)
				got.push(val);
		}
		return got;
	}
	getElement_RL(instance, index){
		const { list } = this;
		const got = [];

		for (let i = 0; i < list.length; i++) {
			const EM = list[i];
			let val;

			if(index.constructor === Number){
				if(typeof instance[index] !== 'object')
					val = (EM.parentChilds || EM.elements)[index];
				else
					val = EM.elementRef.get(instance[index]);
			}
			else val = EM.elementRef.get(index);

			if(val)
				got.push(val);
		}

		return got;
	}

	$el(selector){
		const list = [];
		const $EMs = this.list;
		for (let i = 0; i < $EMs.length; i++) {
			const em = $EMs[i];
			list.push.apply(list, queryElements((em.parentChilds || em.elements), selector));
		}
		return $(list);
	}

	hardRefresh(){
		const { list } = this;
		for (let i = 0; i < list.length; i++)
			list[i].hardRefresh.apply(list[i], arguments);
	}
	update(){
		const { list } = this;
		for (let i = 0; i < list.length; i++)
			list[i].update.apply(list[i], arguments);
	}
	move(){
		const { list } = this;
		for (let i = 0; i < list.length; i++)
			list[i].move.apply(list[i], arguments);
	}
	swap(){
		const { list } = this;
		for (let i = 0; i < list.length; i++)
			list[i].swap.apply(list[i], arguments);
	}
	remove(){
		const { list } = this;
		for (let i = 0; i < list.length; i++)
			list[i].remove.apply(list[i], arguments);
	}
	removeRange(){
		const { list } = this;
		for (let i = 0; i < list.length; i++)
			list[i].removeRange.apply(list[i], arguments);
	}
	clear(){
		const { list } = this;
		for (let i = 0; i < list.length; i++)
			list[i].clear.apply(list[i], arguments);
	}
	insertAfter(){
		const { list } = this;
		for (let i = 0; i < list.length; i++)
			list[i].insertAfter.apply(list[i], arguments);
	}
	prepend(){
		const { list } = this;
		for (let i = 0; i < list.length; i++)
			list[i].prepend.apply(list[i], arguments);
	}
	append(){
		const { list } = this;
		for (let i = 0; i < list.length; i++)
			list[i].append.apply(list[i], arguments);
	}
	reverse(){
		const { list } = this;
		for (let i = 0; i < list.length; i++)
			list[i].reverse.apply(list[i], arguments);
	}
}

internal.EM = ElementManipulator;
internal.EMP = ElementManipulatorProxy;

function RE_restoreBindedList(modelRoot, lists){
	// lists [paths, backup]
	for (let i = 0; i < lists.length; i++) {
		const bindList = RE_getBindedList(modelRoot, lists[i][0]);
		if(bindList === void 0)
			continue;

		bindList.push(lists[i][1]);
	}
}

// return sf$bindedKey or undefined
function RE_getBindedList(modelRoot, binded){
	if(binded.length === 1)
		return modelRoot.sf$bindedKey[binded[0]];

	const check = deepProperty(modelRoot, binded.slice(0, -1));
	if(check === void 0 || check.sf$bindedKey === void 0)
		return;

	return check.sf$bindedKey[binded[binded.length - 1]];
}
function elseIfHandle(else_, arg){
	const { elseIf } = else_;

	// Else if
	for (let i = 0; i < elseIf.length; i++) {
		// Check the condition
		if(!elseIf[i][0](arg[0], arg[1], _escapeParse))
			continue;

		// Get the value
		return elseIf[i][1](arg[0], arg[1], _escapeParse);
	}

	// Else
	if(else_.elseValue === null)
		return '';

	return else_.elseValue(arg[0], arg[1], _escapeParse);
}

// ==== Template parser ====
const templateParser_regex = /{{%=([0-9]+)%/g;
const templateParser_regex_split = /{{%=[0-9]+%/g;
const REF_DIRECT = 0, REF_IF = 1, REF_EXEC = 2;
const templateExec = function(parse, item, atIndex, parsed, repeatListIndex){
	if(parse.length === 0) return parse;
	var temp;

	if(parsed === void 0)
		parsed = new Array(parse.length);

	// Get or evaluate static or dynamic data
	for (let i = 0, n = parse.length; i < n; i++) {
		if(atIndex !== void 0 && atIndex.includes(i) === false)
			continue;

		const ref = parse[i];
		const arg = ref.data;
		arg[0] = item; //7ms

		try{
			// Direct evaluation type
			if(ref.type === REF_DIRECT){
				temp = ref.get(arg[0], arg[1], _escapeParse, repeatListIndex);
				if(temp === void 0)
					temp = '';
				else{
					if(temp.constructor === Object)
						temp = JSON.stringify(temp);
					else if(temp.constructor !== String)
						temp = String(temp);
				}

				parsed[i] = temp;
				continue;
			}

			if(ref.type === REF_EXEC){
				parsed[i] = ref.get(arg[0], arg[1], _escapeParse, repeatListIndex);
				continue;
			}

			// Conditional type
			if(ref.type === REF_IF){
				// If condition was not meet
				if(!ref.if[0](arg[0], arg[1], _escapeParse, repeatListIndex)){
					parsed[i] = elseIfHandle(ref, arg, repeatListIndex);
					continue;
				}

				parsed[i] = ref.if[1](arg[0], arg[1], _escapeParse, repeatListIndex);
			}
		} catch(e) {
			var temp = (ref.get || ref.if).toString();
			temp = temp.split(') {', 2)[1].slice(1, -2);
			temp = temp.replace(/(_model_|_modelScope)\./g, '');
			temp = temp.replace(/var _model_=.*?;/, '');

			if(e.message === "Can't continue processing the template"){
				console.groupCollapsed("Click here to open more information..");
				console.log("%cError in template's script:\n", 'color:orange', temp);
			}
			else{
				console.groupCollapsed("%cError message:", 'color:orange', e.message, "\nClick here to open more information..");
				console.log(e.stack);
				console.log("%cWhen processing template's script:\n", 'color:orange', temp);
				console.groupEnd();
			}

			throw new Error("Can't continue processing the template");
		}
	}

	return parsed;
}
function parserForAttribute(current, ref, item, modelRef, parsed, changesReference, rootHandler, template){
	for(let a = 0; a < ref.length; a++){
		const refB = ref[a];

		// Pass to event handler
		if(refB.event){
			if(rootHandler === void 0 || rootHandler.sf$listListenerLock === void 0)
				eventHandler(current, refB, modelRef || item, rootHandler, template);

			continue;
		}

		const isValueInput = (refB.name === 'value' && (current.tagName === 'TEXTAREA' ||
			(current.tagName === 'INPUT' && sfRegex.inputAttributeType.test(current.type) === false)
		));

		var temp = {ref:refB};

		if(refB.name === 'style')
			temp.style = current.style;
		else{
			temp.attribute = isValueInput === true
				? current
				: (refB.name === 'class'
				   ? current.classList
				   : current.attributes[refB.name]);
		}

		if(current.hasAttribute('sf-lang'))
			temp.sf_lang = current;

		changesReference.push(temp);

		if(refB.direct !== void 0){
			if(refB.name === 'value' && isValueInput === true){
				current.value = parsed[refB.direct];
				current.removeAttribute('value');
				continue;
			}
			current.setAttribute(refB.name, parsed[refB.direct]);
			continue;
		}

		// Below is used for multiple data
		if(refB.name === 'value' && isValueInput === true){
			var temp = current.value;
			current.removeAttribute('value');
			current.value = applyParseIndex(refB.value, refB.parse_index, parsed);
		}
		else current.setAttribute(refB.name, applyParseIndex(refB.value, refB.parse_index, parsed));
	}
}

const templateParser = internal.model.templateParser = function(template, item, original, modelRef, rootHandler, copy, repeatListIndex){
	processingElement = template.html;

	let html = original === true ? template.html : template.html.cloneNode(true);
	const { addresses } = template;

	try{
		var parsed = templateExec(template.parse, item, void 0, void 0, repeatListIndex);  //18ms
	}catch(e){
		if(e.message === "Can't continue processing the template"){
			console.error("Error when processing:", template.html, item, modelRef);
			console.groupEnd();
		}
		else sf.onerror && sf.onerror(e);

		throw e;
	}

	if(template.uniqPattern !== void 0)
		html.sf$repeatListIndex = repeatListIndex;

	if(copy !== void 0){
		const childs = html.childNodes;
		for (var i = 0, n = childs.length; i < n; i++) {
			copy.appendChild(childs[0]);
		}

		// Assign attributes
		const attr = html.attributes;
		for (var i = 0; i < attr.length; i++) {
			copy.setAttribute(attr[i].name, attr[i].value);
		}

		html = copy;
	}

	const changesReference = [];
	const pendingInsert = [];

	changesReference.parsed = parsed;

	// Find element where the data belongs to
	for (var i = 0; i < addresses.length; i++) {
		var ref = addresses[i];
		const current = $.childIndexes(ref.address, html); //26ms

		// Modify element attributes
		if(ref.nodeType === 1){
			parserForAttribute(current, ref.attributes, item, modelRef, parsed, changesReference, rootHandler, template); //26ms
			continue;
		}

		// Replace text node
		if(ref.nodeType === 3){
			const refA = current;

			changesReference.push({
				textContent:refA,
				ref
			});

			if(ref.direct !== void 0){
				refA.textContent = parsed[ref.direct]; //40ms
				continue;
			}

			// Below is used for multiple/dynamic data
			current.textContent = applyParseIndex(ref.value, ref.parse_index, parsed);
			continue;
		}

		// Replace dynamic node
		if(ref.nodeType === -1){
			const cRef = {
				dynamicFlag:current,
				direct:ref.parse_index,
				parentNode:current.parentNode,
				startFlag:ref.startFlag && $.childIndexes(ref.startFlag, html)
			};
			changesReference.push(cRef);

			// Pending element insert to take other element reference
			pendingInsert.push(cRef);
		}
	}

	if(rootHandler !== void 0)
		rootHandler.sf$listListenerLock = true;

	// Save model item reference to node
	html.model = item;

	// Save reference to element
	if(changesReference.length !== 0){
		changesReference.template = template;
		html.sf$elementReferences = changesReference;
	}

	// html.sf$modelParsed = parsed;

	// Run the pending element
	for (var i = 0; i < pendingInsert.length; i++) {
		var ref = pendingInsert[i];
		let tDOM = parsed[ref.direct];

		// Check if it's an HTMLElement
		if(tDOM.nodeType === 1){
			ref.parentNode.insertBefore(tDOM, ref.dynamicFlag);
			continue;
		}

		// Parse if it's not HTMLElement
		tDOM = $.parseElement(parsed[ref.direct]);
		for (var a = 0, n = tDOM.length; a < n; a++) {
			ref.parentNode.insertBefore(tDOM[0], ref.dynamicFlag);
		}
	}

	if(template.specialElement){
		if(template.specialElement.input){
			// Process element for input bind
			const specialInput = template.specialElement.input;
			const specialInput_ = new Array(specialInput.length);
			for (var i = 0; i < specialInput.length; i++) {
				var ref = specialInput[i];
				specialInput_[i] = {
					el:$.childIndexes(ref.addr, html),
					rule:ref.rule,
					id:ref.id,
				};
			}

			bindInput(specialInput_, item, template.mask, modelRef);
		}

		if(template.specialElement.repeat){
			// Process element for sf-repeat-this
			const specialRepeat = template.specialElement.repeat;
			const specialRepeat_ = new Array(specialRepeat.length);
			for (var i = 0; i < specialRepeat.length; i++) {
				var ref = specialRepeat[i];
				specialRepeat_[i] = {
					el:$.childIndexes(ref.addr, html),
					rule:ref.rule
				};
			}

			repeatedListBinding(specialRepeat_, item, void 0, template);
		}
	}

	return html;
}

sf.async = function(mode){
	if(mode)
		animFrameMode = false; // Enable async
	else animFrameMode = true; // Disable async
}

var animFrameMode = false;
const syntheticTemplate = internal.model.syntheticTemplate = function(element, template, property, item, asyncing){
	if(property !== void 0){
		var changes = (template.modelRef && template.modelRef[property]) || template.modelRefRoot[property];
		if(!changes || changes.length === 0){
			console.log(element, template, property, item);
			console.error(`Failed to run syntheticTemplate because property '${property}' is not observed`);
			return false;
		}
	}
	else{ // This will trying to update all binding
		if(template.parse.length === 0)
			return false;

		var changes = void 0;
	}

	const changesReference = element.sf$elementReferences;

	if(changesReference.parsed === void 0)
		changesReference.parsed = new Array(template.parse.length);

	const { parsed } = changesReference;
	const repeatListIndex = element.sf$repeatListIndex;

	if(!asyncing)
		templateExec(template.parse, item, changes, parsed, repeatListIndex);

	if(!asyncing && animFrameMode === false){
		if(changesReference.async === true)
			return;

		changesReference.async = true;
		requestAnimationFrame(function(){
			changesReference.async = false;
			animFrameMode = true;
			syntheticTemplate(element, template, property, item, true);
			animFrameMode = false;
		});
		return;
	}

	let haveChanges = false, temp;
	for (let i = 0; i < changesReference.length; i++) {
		const cRef = changesReference[i];

		if(cRef.dynamicFlag !== void 0){ // Dynamic data
			if(parsed[cRef.direct] !== void 0){
				const tDOM = Array.from($.parseElement(parsed[cRef.direct]));
				const currentDOM = $.prevAll(cRef.dynamicFlag, cRef.startFlag);
				let notExist = false;

				// Replace if exist, skip if similar
				for (var a = tDOM.length-1; a >= 0; a--) {
					if(currentDOM[a] === void 0){
						notExist = true;
						break;
					}

					if(currentDOM[a].isEqualNode(tDOM[a]) === false)
						cRef.parentNode.replaceChild(tDOM[a], currentDOM[a]);
				}

				// Add if not exist
				if(notExist){
					for (var a = 0; a < tDOM.length; a++)
						cRef.parentNode.insertBefore(tDOM[a], cRef.dynamicFlag);
				}

				// Remove if over index
				else{
					for (var a = tDOM.length; a < currentDOM.length; a++)
						currentDOM[a].remove();
				}

				haveChanges = true;
			}
			continue;
		}

		if(cRef.textContent !== void 0){ // Text only
			if(cRef.ref.parse_index !== void 0){ // Multiple
				temp = applyParseIndex(cRef.ref.value, cRef.ref.parse_index, parsed, template.parse, item, repeatListIndex);
				if(cRef.textContent.textContent === temp) continue;
				cRef.textContent.textContent = temp;

				haveChanges = true;
				continue;
			}

			// Direct value
			if(parsed[cRef.ref.direct]){
				temp = parsed[cRef.ref.direct];
				if(cRef.textContent.textContent === temp) continue;

				const ref_ = cRef.textContent;
				// Remove old element if exist
				if(ref_.sf$haveChilds === true){
					while(ref_.previousSibling && ref_.previousSibling.sf$childRoot === ref_)
						ref_.previousSibling.remove();
				}

				ref_.textContent = temp;
				haveChanges = true;
			}
			continue;
		}

		if(cRef.attribute !== void 0){ // Attributes
			if(cRef.ref.parse_index !== void 0){ // Multiple
				temp = applyParseIndex(cRef.ref.value, cRef.ref.parse_index, parsed, template.parse, item, repeatListIndex);
				if(cRef.attribute.value === temp) continue;
			}

			// Direct value
			else if(parsed[cRef.ref.direct]){
				temp = parsed[cRef.ref.direct];
				if(cRef.attribute.value == temp) continue; // non-strict compare
			}
			else continue;

			cRef.attribute.value = temp;
			haveChanges = true;
			continue;
		}

		if(cRef.style !== void 0){ // Styles
			if(cRef.ref.parse_index !== void 0) // Multiple
				temp = applyParseIndex(cRef.ref.value, cRef.ref.parse_index, parsed, template.parse, item, repeatListIndex);

			// Direct value
			else if(parsed[cRef.ref.direct])
				temp = parsed[cRef.ref.direct];
			else continue;

			if(cRef.style.cssText === temp) continue;
			cRef.style.cssText = temp;
			haveChanges = true;
		}
	}

	return haveChanges;
};
})();

// Let's check all pending model
$(function(){
	for(var keys in internal.modelPending){
		var ref = internal.modelPending[keys];
		for (var z = 0; z < ref.length; z++)
			sf.model.init(ref[z], ref[z].getAttribute('name'));

		delete internal.modelPending[keys];
	}
});
class API{
	constructor(url){
		this.url = url;
		this.accessToken = false;
		this.mask = true;
	}
	get(url, data){
		return this.request('GET', this.url+url, data);
	}
	post(url, data){
		return this.request('POST', this.url+url, data);
	}
	delete(url, data){
		return this.request('DELETE', this.url+url, data);
	}
	put(url, data){
		return this.request('PUT', this.url+url, data);
	}
	upload(url, formData){
		if(formData.constructor !== FormData)
			return console.error("Parameter 2 must be a FormData");

		return this.request('POST', this.url+url, formData);
	}
	request(method, url, data, beforeSend){
		if(data === void 0)
			data = {};

		if(this.mask){
			var options = {receiveType:'JSON'};

			if(data.constructor === FormData)
				data.append('_method', method.toUpperCase());
			else{
				options.sendType = 'JSON';
				data._method = method.toUpperCase();
			}
		}
		else var options = {};

		if(this.accessToken){
			const { accessToken } = this;
			options.beforeSend = function(xhr){
			    xhr.setRequestHeader('X-Authorization', `Bearer ${accessToken}`);
			    beforeSend && beforeSend(xhr);
			}
		}
		else if(beforeSend !== void 0)
			options.beforeSend = beforeSend;

		if(this.mask)
			return sf.request('POST', url, data, options);
		return sf.request(method, url, data, options);
	}
};

sf.API = API;
sf.events = (function(){
	self._listener = {};
	self._statusTrigger = {};

	function Events(name, defaultVal){
		if(name.constructor === Array){
			for (let i = 0; i < name.length; i++)
				Events(name[i], defaultVal);

			return;
		}

		// Events.when (Status Trigger)
		// Status trigger only triggered when true otherwise it will pending the callback
		// After triggered, all events will be cleared
		if(defaultVal !== void 0 && defaultVal.constructor === Boolean){
			if(Events[name] !== void 0 && Events[name] !== defaultVal)
				console.warn("Events", name, "already has value:", Events[name]);

			const trigger = function(){
				const ref = self._statusTrigger[name];
				if(ref !== void 0){
					for (let i = 0; i < ref.length; i++) {
						try{
							ref[i]();
						} catch(e) {
							console.error(e);
							sf.onerror && sf.onerror(e);
						}
					}

					// Remove all pending callback
					delete self._statusTrigger[name];
				}
			}

			let active = Events[name] || defaultVal;
			Object.defineProperty(Events, name, {
				enumerable:true,
				configurable:true,
				get(){return active},
				set(val){
					if(active === val)
						return;

					active = val;
					if(active) trigger();
				}
			});

			if(active) trigger();
		}

		// Events.on (Listener)
		else if(Events[name] === void 0){
			Events[name] = function(){
				for (let i = 0; i < callback.length; i++) {
					try{
						// .apply() is performant here
						callback[i].apply(null, arguments);
						if(callback[i].once === true)
							callback.splice(i--, 1);
					} catch(e) {
						console.error(e);
						sf.onerror && sf.onerror(e);
					}
				}
			}

			if(self._listener[name] === void 0)
				self._listener[name] = [];

			const callback = self._listener[name];
		}

		defaultVal = null;
	}

	Events.when = function(name, callback){
		if(Events[name] === true)
			return callback();

		if(self._statusTrigger[name] === void 0)
			self._statusTrigger[name] = [];

		self._statusTrigger[name].push(callback);
	}

	Events.once = function(name, callback){
		callback.once = true;
		self._listener[name].push(callback);
	}

	Events.on = function(name, callback){
		if(self._listener[name] === void 0)
			self._listener[name] = [];

		self._listener[name].push(callback);
	}

	Events.off = function(name, callback){
		if(self._listener[name] === void 0)
			return self._listener[name].length = 0;

		const i = self._listener[name].indexOf(callback);
		if(i === -1) return;
		self._listener[name].splice(i, 1);
	}

	return Events;
})();

if(!window.TouchEvent)
	window.TouchEvent = void 0;
;(function(){

const self = sf.lang = function(el){
	sf.lang.init(el);
}

self.list = {};
self.default = 'en_US';
self.serverURL = false;
self.interpolate = {}

internal.language = {};

self.add = function(lang, obj){
	if(self.list[lang] === void 0)
		self.list[lang] = {};

	diveFill(self.list[lang], obj);

	pending = false;
	if(pendingCallback.length === 0)
		return;

	const defaultLang = self.list[self.default];
	for (let i = 0; i < pendingCallback.length; i++) {
		if(pendingCallback[i].callbackOnly === void 0)
			pendingCallback[i](diveObject(defaultLang, pendingCallback[i].path));
		else
			pendingCallback[i]();
	}

	pendingCallback.length = 0;
}

self.changeDefault = function(defaultLang){
	self.default = defaultLang;

	// Maybe have create other window?
	if(windowDestroyListener !== false && sf.window.list.length !== 0){
		const windows = sf.window.list;

		for (let i = 0; i < windows.length; i++)
			windows[i].sf.lang.changeDefault(defaultLang);
	}

	function forComponents(){
		const { registered } = sf.component;
		for(let keys in registered){
			if(registered[keys][3] !== void 0)
				refreshTemplate(registered[keys]);
		}
	}

	function forSpaceComponents(){
		const { list } = sf.space;

		for(let name in list){
			const { registered } = list[name].default;

			for(let keys in registered){
				if(registered[keys][3] !== void 0)
					refreshTemplate(registered[keys]);
			}
		}
	}

	if(self.list[defaultLang] === void 0){
		forComponents.callbackOnly = true;
		pendingCallback.push(forComponents);
	}
	else forComponents();

	self.init(document.body);

	const wList = sf.window.list;
	for(let key in wList)
		self.init(wList[key].document.body);
}

const interpolate_ = /{(.*?)}/;
function interpolate(text, obj){
	let once = false;
	return text.replace(interpolate_, function(full, match){
		if(once === false && (obj.constructor === String || obj.constructor === Number)){
			once = true;
			return obj;
		}

		if(obj[match] !== void 0)
			return obj[match].constructor === Function ? obj[match]() : obj[match];

		if(self.interpolate[match] !== void 0)
			return self.interpolate[match].constructor === Function ? self.interpolate[match]() : self.interpolate[match];

		return full;
	});
}

let waiting = false;
var pendingCallback = [];

self.get = function(path, obj, callback){
	if(obj !== void 0 && obj.constructor === Function){
		callback = obj;
		obj = void 0;
	}

	if(self.list[self.default] === void 0)
		self.list[self.default] = {};

	if(path.constructor === String)
		return getSingle(path, obj, callback);
	else
		return getMany(path, obj, callback);
}

function startRequest(){
	if(pending === false || self.serverURL === false)
		return;

	// Request to server after 500ms
	// To avoid multiple request
	clearTimeout(waiting);
	waiting = setTimeout(function(){
		if(activeRequest !== false)
			activeRequest.abort();

		activeRequest = sf.request('POST', self.serverURL, {
			lang:self.default,
			paths:JSON.stringify(pending)
		}, {
			sendType:'JSON',
			receiveType:'JSON',
		})
		.done(function(obj){
			pending = false;
			self.add(self.default, obj);
		})
		.fail(self.onError);
	}, 500);
}

function getSingle(path, obj, callback){
	let value = diveObject(self.list[self.default], path);
	if(value !== void 0){
		if(obj)
			value = interpolate(value, obj);

		if(callback === void 0)
			return value;
		return callback(value);
	}

	if(pending === false)
		pending = {};

	diveObject(pending, path, 1);

	if(callback){
		callback.path = path;
		pendingCallback.push(callback);
	}

	startRequest();
	return path;
}

function getMany(paths, obj, callback){
	const default_ = self.list[self.default];
	let value = {};
	const missing = [];

	for (var i = 0; i < paths.length; i++) {
		const temp = diveObject(default_, paths[i]);

		if(temp)
			value[paths[i]] = temp;
		else
			missing.push(paths[i]);
	}

	if(missing.length === 0){
		if(obj)
			value = interpolate(value, obj);

		if(callback === void 0)
			return value;
		return callback(value);
	}

	if(pending === false)
		pending = {};

	for (var i = 0; i < missing.length; i++) {
		diveObject(pending, missing[i], 1);
	}

	const callback_ = function(){
		for (let i = 0; i < missing.length; i++) {
			const temp = diveObject(default_, missing[i]);

			diveObject(value, missing[i], temp);
		}

		return callback(value);
	}

	callback_.callbackOnly = true;
	pendingCallback.push(callback_);

	startRequest();
}

self.assign = function(model, keyPath, obj, callback){
	if(self.list[self.default] === void 0)
		self.list[self.default] = {};

	if(obj !== void 0 && obj.constructor === Function){
		callback = obj;
		obj = void 0;
	}

	const keys = Object.keys(keyPath);
	const vals = Object.values(keyPath);

	getMany(vals, obj, function(values){
		for (let i = 0; i < keys.length; i++) {
			model[keys[i]] = diveObject(values, vals[i]);
		}

		if(callback)
			callback();
	});
}

function diveFill(obj1, obj2){
	for(let key in obj2){
		if(obj1[key] === void 0)
			obj1[key] = obj2[key];

		else if(obj2[key].constructor === Object)
			diveFill(obj1[key], obj2[key]);
	}
}

var pending = false;
const pendingElement = [];
var activeRequest = false;

self.onError = console.error;

self.init = function(el){
	const list = el.querySelectorAll('[sf-lang]');
	if(list.length === 0)
		return;

	if(self.list[self.default] === void 0)
		self.list[self.default] = {};

	refreshLang(list);

	if(pending !== false && self.serverURL !== false){
		const callback = function(){
			pending = false;
			refreshLang(pendingElement, true);
		}

		callback.callbackOnly = true;
		pendingCallback.push(callback);

		startRequest();
	}

	if(pending !== false && self.serverURL === false)
		console.warn("Some language was not found, and the serverURL was set to false", pending);
}

function diveObject(obj, path, setValue){
	const parts = path.split('.');
	for (let i = 0, n = parts.length-1; i <= n; i++) {
		const key = parts[i];

		if(setValue === void 0){ // get only
	    	if(obj[key] === void 0)
	    		return;

	    	obj = obj[key];
		}
		else{ // set
			if(i === n){
				obj[key] = setValue;
				return;
			}

			if(obj[key] === void 0)
                obj = obj[key] = {};
            else obj = obj[key];
		}
    }

    return obj;
}

internal.language.refreshLang = function(el){
	if(el.hasAttribute === void 0)
		return;

	if(el.hasAttribute('sf-lang'))
		return refreshLang([el]);

	el = el.querySelectorAll('[sf-lang]');
	if(el.length === 0)
		return;

	refreshLang(el);
};

function refreshLang(list, noPending){
	let defaultLang = self.list[self.default];
	const parentElement = new Set();

	if(defaultLang === void 0)
		defaultLang = self.list[self.default] = {};

	const checks = new WeakSet();
	for (let i = list.length-1; i >= 0; i--) {
		if((list[i].sf_lang === self.default && noPending === true) || list[i].hasAttribute('sf-lang-skip')){
			list.splice(i, 1);
			continue;
		}

		var elem = list[i];
		if(checks.has(elem))
			continue;

		checks.add(elem);

		// Preserve model/component binding
		// We will reapply the template later
		if(elem.sf$elementReferences !== void 0 && elementReferencesRefresh(elem)){
			parentElement.add(elem);
			continue;
		}
		else{
			const modelElement = sf(elem, true);
			if(modelElement !== null){
				if(parentElement.has(modelElement))
					continue;

				// Run below once
				if(modelElement.sf$elementReferences !== void 0 && elementReferencesRefresh(modelElement)){
					parentElement.add(modelElement);
					continue;
				}

				if(elem.tagName === 'INPUT' || elem.tagName === 'TEXTAREA'){
					if(!elem.hasAttribute('placeholder'))
						continue;
				}
			}
		}

		const target = elem.getAttribute('sf-lang');
		const value = diveObject(defaultLang, target);

		if(value === void 0){
		    if(noPending !== true){
				if(pending === false)
			    	pending = {};

			    diveObject(pending, target, 1);
				pendingElement.push(elem);
		    }

			continue;
		}

		if(noPending === true)
			list.splice(i, 1);

		if(elem.hasAttribute('placeholder'))
			elem.setAttribute('placeholder', value);
		else if(elem.tagName !== 'INPUT' && elem.tagName !== 'TEXTAREA')
			assignSquareBracket(value, elem);
	}

	if(parentElement.size === 0)
		return;

	const appliedElement = new WeakSet();

	// Reapply template (component)
	for(var elem of parentElement){
		elem.sf_lang = self.default;

		let { model } = elem;
		if(model === void 0)
			model = sf(elem);

		// Avoid model that doesn't have binding
		if(model.sf$bindedKey === void 0)
			continue;

		if(appliedElement.has(elem))
			continue;

		appliedElement.add(elem);

		if(internal.model.syntheticTemplate(elem, elem.sf$elementReferences.template, void 0, model) !== false)
			continue; // updated

		elem.sf_lang = void 0;
	}
}

const templateParser_regex_split = /{{%=[0-9]+%/g;
function elementReferencesRefresh(elem){
	const eRef = elem.sf$elementReferences;
	let processed = false;
	const { template } = eRef;

	if(eRef.parsed === void 0)
		eRef.parsed = new Array(template.parse);

	for (var i = eRef.length-1; i >= 0; i--) {
		const elemRef = eRef[i];
		if(elemRef.textContent !== void 0){
			var parent = elemRef.textContent.parentElement;

			if(parent === null || parent.hasAttribute('sf-lang') === false)
				continue;

			var key = parent.getAttribute('sf-lang');
		}
		else if(elemRef.sf_lang !== void 0){
			var parent = elemRef.sf_lang;
			var key = elemRef.sf_lang.getAttribute('sf-lang');
		}
		else continue;

		const value = diveObject(self.list[self.default], key);
		if(value === void 0){
			if(pending === false)
				pending = {};

			diveObject(pending, key, 1);
			pendingElement.push(parent);
			return; // Let's process it later for current element
		}

		// Different behaviour
		if(elemRef.attribute !== void 0){
			createParseIndex(value, elemRef.ref, template);

			// Refresh it now
			// ToDo: fix value that fail/undefined if it's from RepeatedList/Property
			if(elemRef.ref.name === 'value'){
				const refB = elemRef.ref;
				elemRef.attribute.value = internal.model.applyParseIndex(refB.value, refB.parse_index, eRef.parsed, template.parse);
			}
			continue;
		}

		// Remove because we would remake that
		eRef.splice(i, 1);

		if(!assignSquareBracket(value, parent, template, eRef))
			continue;

		processed = true;
	}

	// Fix memory leak
	for (var i = eRef.length-1; i >= 0; i--) {
		if(eRef[i].textContent && eRef[i].textContent.isConnected === false)
			eRef.splice(i, 1);
	}

	return processed;
}

function assignSquareBracket(value, elem, template, eRef){
	value = value.replace(/%\*&/g, '-');
	const tags = {};

	const squares = [];
	value = value.replace(/\[([a-zA-Z0-9\-]+):(.*?)\]/g, function(full, tag, match){
		squares.push({tag:tag.toUpperCase(), val:match});
		return '%*&';
	}).split('%*&');

	const { childNodes } = elem;
	const backup = {};
	for(var a=0, n=childNodes.length; a<n; a++){
		var place, elemBackup = childNodes[a];
		if(elemBackup.nodeType === 3){
			place = backup._text;
			if(place === void 0)
				place = backup._text = [];
		}
		else if(elemBackup.nodeType === 1){
			place = backup[elemBackup.tagName];
			if(place === void 0)
				place = backup[elemBackup.tagName] = [];
		}
		else continue;

		place.push(elemBackup);
	}

	let found = template && true;
	elem.textContent = value[0];

	if(elem.firstChild !== null)
		found = found && elementRebinding(template, eRef, elem.firstChild, elem);

	for (var a = 1; a < value.length; a++) {
		const square = squares[a-1];
		var elemBackup = backup[square.tag];
		if(elemBackup === void 0 || elemBackup.length === 0)
			elemBackup = document.createElement(square.tag);
		else elemBackup = elemBackup.pop();

		elemBackup.textContent = square.val;
		elem.appendChild(elemBackup);
		found = found && elementRebinding(template, eRef, elemBackup.firstChild, elem);

		var elemBackup = backup._text;
		if(elemBackup === void 0 || elemBackup.length === 0)
			elemBackup = new Text(value[a]);
		else{
			elemBackup = elemBackup.pop();
			elemBackup.textContent = value[a];
		}

		elem.appendChild(elemBackup);
		found = found && elementRebinding(template, eRef, elemBackup, elem);
	}

	if(value[a-1] === '')
		elemBackup.remove();

	if(found === false && template)
		return false;
	return true;
}

function createParseIndex(text, remakeRef, template){
	const parse_index = []
	const value = text.replace(/{(.*?)}/g, function(full, match){
		if(isNaN(match) !== false){
			if(template.modelRefRoot[match] !== void 0)
				match = template.modelRefRoot[match][0];

			else if(template.modelRef !== void 0 && template.modelRef[match] !== void 0)
				match = template.modelRef[match][0];
			else{
				console.error(`Language can't find existing model binding for '${match}' from`, Object.keys(template.modelRefRoot), template);
				return '';
			}
		}

		parse_index.push(match);
		return '%*&';
	});

	if(parse_index.length === 0)
		return false;

	remakeRef.parse_index = parse_index;
	remakeRef.value = value.split('%*&');
	internal.model.parseIndexAllocate(remakeRef.value);
	return true;
}

function elementRebinding(template, eRef, elem, parentNode){
	const remake = {
		textContent:elem,
		ref:{
			address:$.getSelector(elem, true, parentNode),
			nodeType:3
		}
	};

	if(createParseIndex(elem.textContent, remake.ref, template))
		eRef.push(remake);

	return true;
}

function refreshTemplate(elemRef){
	const collections = elemRef[2];
	const template = elemRef[3];

	const { addresses } = template;
	if(addresses === void 0)
		return;

	let found = false;
	for (let i = addresses.length-1; i >= 0; i--) {
		if(addresses[i].skipSFLang || addresses[i].value === void 0)
			continue;

		const elem = $.childIndexes(addresses[i].address, template.html).parentNode;
		if(elem.hasAttribute('sf-lang') === false)
			continue;

		found = true;

		const value = diveObject(self.list[self.default], elem.getAttribute('sf-lang'));
		if(value === void 0){
			console.error(`Can't found '${elem.getAttribute('sf-lang')}' for ${self.default}, in`, self.list[self.default], ", maybe the language wasn't fully loaded");

			const callback_ = function(){
				refreshTemplate(elemRef);
			};

			callback_.callbackOnly = true;
			pendingCallback.push(callback_);
			return;
		}

		addresses.splice(i, 1);

		const eRef = [];
		assignSquareBracket(value, elem, template, eRef);

		for (let a = 0; a < eRef.length; a++){
			const { ref } = eRef[a];
			ref.address = $.getSelector($.childIndexes(ref.address, elem), true, template.html);
			addresses.push(ref);
		}
	}

	if(found === false)
		template.skipSFLang = true; // skip because not found
}

})();
$.get = (url, data, options, callback) => custom('GET', url, data, options, callback)
$.post = (url, data, options, callback) => custom('POST', url, data, options, callback)
$.getJSON = (url, data, options, callback) => custom('getJSON', url, data, options, callback)
$.postJSON = (url, data, options, callback) => custom('postJSON', url, data, options, callback)

sf.request = custom;
const statusCode = sf.request.statusCode = {};
sf.request.onerror = null;
sf.request.onsuccess = null;

function custom(method, url, data, options, callback){
	if(data && data.constructor === Function){
		callback = data;
		data = void 0;
	}

	if(options && options.constructor === Function){
		callback = options;
		options = void 0;
	}

	if(options === void 0)
		options = {};

	if(method === 'getJSON'){
		options.receiveType = 'JSON';
		method = 'GET';
	}

	if(method === 'postJSON'){
		options.sendType = 'JSON';
		method = 'POST';
	}

	return request(method, url, data, options, callback);
}

function request(method, url, data, options, callback){
	const xhr = new XMLHttpRequest();
	options.beforeOpen && options.beforeOpen(xhr);

	if(method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || method === 'DELETE'){
		url += (url.includes('?') === false ? '?' : '')+serializeQuery(data);
		data = null;
	}

	xhr.open(method, url, options.async || true, options.user, options.password);

	if(options.headers)
		for(var name in options.headers)
			xhr.setRequestHeader(name, options.headers[name]);

	if(typeof data === 'object' && data !== null && data.constructor !== FormData){
		if(options.sendType === 'JSON'){
			xhr.setRequestHeader('Content-Type', 'application/json');
			data = JSON.stringify(data);
		}
		else{
			const temp = data;

			data = new FormData();
			for(var name in temp){
				const val = temp[name];

				if(val.constructor === Array){
					for (let i = 0; i < val.length; i++)
						data.append(name+'[]', val[i]);
					continue;
				}

				if(val.constructor === Object){
					for(let valKey in val)
						data.append(name+'['+valKey+']', val[valKey]);
					continue;
				}

				data.append(name, val);
			}
		}
	}

	if(!callback || callback.constructor !== Object)
		callback = {done:callback};

	xhr.fail = function(func){
		callback.fail = func;
		return xhr;
	}
	xhr.done = function(func){
		callback.done = func;
		return xhr;
	}
	xhr.always = function(func){
		callback.always = func;
		return xhr;
	}
	xhr.progress = function(func){
		xhr.onprogress = xhr.onloadstart = func;
		return xhr;
	}
	xhr.uploadProgress = function(func){
		xhr.upload.onprogress = xhr.upload.onloadstart = func;
		return xhr;
	}

	xhr.onerror = function(){
		sf.request.onerror && sf.request.onerror(xhr);
		callback.fail && callback.fail(xhr.status);
		callback.always && callback.always('error');
	}

	xhr.onload = function(){
		if((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0){
			if(options.receiveType === 'JSON'){
				let parsed = void 0;
				try{
					parsed = JSON.parse(xhr.responseText);
				}catch(e){
					callback.fail && callback.fail('parseerror', xhr.responseText);
				}

				if(parsed !== void 0){
					callback.done && callback.done(JSON.parse(xhr.responseText), xhr.status);
					sf.request.onsuccess && sf.request.onsuccess(xhr);
				}
			}
			else{
				callback.done && callback.done(xhr.responseText || xhr.response, xhr.status);
				sf.request.onsuccess && sf.request.onsuccess(xhr);
			}
		}
		else if(callback.fail){
			if(options.receiveType === 'JSON'){
				try{
					callback.fail(xhr.status, JSON.parse(xhr.responseText));
				}catch(e){
					callback.fail(xhr.status, xhr.responseText);
				}
			}
			else callback.fail(xhr.status, xhr.responseText);
		}

		statusCode[xhr.status] && statusCode[xhr.status](xhr);
		callback.always && callback.always(xhr.status);
	}

	options.beforeSend && options.beforeSend(xhr);
	xhr.send(data);

	return xhr;
}

function serializeQuery(params) {
	const keys = [];
	for(let key in params){
		const val = params[key];
		if (val.constructor === Array){
			for (let i = 0; i < val.length; i++)
				keys.push(key+"[]="+encodeURIComponent(val[i]));
			continue;
		}

		if(val.constructor === Object){
			for(let valKey in val)
				keys.push(key+"["+valKey+"]="+encodeURIComponent(val[valKey]));
			continue;
		}

		keys.push(key+"="+encodeURIComponent(val));
	}

	return keys.join('&');
}
;(function(){
const self = sf.url = function(){
	// Hashes
	let hashes_ = '';
	for(let keys in hashes){
		if(hashes[keys] === '/') continue;
		hashes_ += `#${keys}${hashes[keys]}`;
	}

	const data_ = `|${self.data.join('|')}`;

	return self.paths + hashes_ + (data_.length !== 1 ? data_ : '');
};

let hashes = self.hashes = {};
self.data = [];
self.paths = '/';

// Push into latest history
self.push = function(){
	window.history.pushState((window.history.state || 0) + 1, '', self());
}

// Remove next history and change current history
self.replace = function(){
	window.history.replaceState(window.history.state, '', self());
}

self.get = function(name, index){
	self.parse();

	if(name.constructor === Number)
		return self.paths.split('/')[name+1];

	if(hashes[name] === void 0)
		return;

	return hashes[name].split('/')[index+1];
}

self.parse = function(url){
	if(url !== void 0){
		const data = {hashes:{}};

		data.data = url.split('|');
		var hashes_ = data.data.shift().split('#');

		for (var i = 1; i < hashes_.length; i++) {
			var temp = hashes_[i].split('/');
			data.hashes[temp.shift()] = `/${temp.join('/')}`;
		}

		// Paths
		data.paths = url.split('#')[0];
		return data;
	}

	self.data = window.location.hash.split('|');
	var hashes_ = self.data.shift().split('#');

	hashes = self.hashes = {};
	for (var i = 1; i < hashes_.length; i++) {
		var temp = hashes_[i].split('/');
		hashes[temp.shift()] = `/${temp.join('/')}`;
	}

	// Paths
	self.paths = window.location.pathname;
	return self;
}

self.parse();

})();
;(function(){
const gEval = routerEval;
routerEval = void 0; // Avoid this function being invoked out of scope

const rejectResponse = /<html/;

// Save reference
const slash = '/';

let routingError = false;
let routeDirection = 1;
let historyIndex = (window.history.state || 1);

let disableHistoryPush = false;

window.addEventListener('popstate', function(ev){
	// Don't continue if the last routing was error
	// Because the router was trying to getting back
	if(routingError){
		routingError = false;
		historyIndex -= routeDirection;
		return;
	}

	disableHistoryPush = true;

	if(window.history.state >= historyIndex)
		routeDirection = 1;
	else
		routeDirection = -1;

	historyIndex += routeDirection;

	// console.warn('historyIndex', historyIndex, window.history.state, routeDirection > 0 ? 'forward' : 'backward');

	// Reparse URL
	self.goto();

	disableHistoryPush = false;
}, false);

const cachedURL = {};

internal.router = {};
internal.router.parseRoutes = function(obj_, selectorList){
	const routes = [];
	const pattern = /\/:([^/]+)/g;
    const knownKeys = /^(path|url|template|templateURL|html|on|routes|beforeRoute|defaultData|cache)$/;

	function addRoutes(obj, addition, selector, parent){
		if(selector !== '')
			selector += ' ';

		for(let i = 0; i < obj.length; i++){
            const ref = obj[i];
			let current = addition+ref.path;

			if(ref.routes !== void 0)
				addRoutes(ref.routes, current, selector, parent);

			current = current.split('//').join('/');

			var keys = [];
			const regex = current.replace(pattern, function(full, match){
				keys.push(match);
				return '/([^/]+)';
			});
			const route = RegExp(`^${regex}$`);

			if(ref.url !== void 0)
				route.url = ref.url;

			else if(ref.templateURL !== void 0)
				route.templateURL = ref.templateURL;

			else if(ref.template !== void 0)
				route.template = ref.template;

			else if(ref.html !== void 0){
				// Create new element
				const dom = route.html = document.createElement('sf-page-view');
				internal.component.skip = true;

				if(ref.html.constructor === String){
					route.html = sf.dom.parseElement(`<template>${ref.html}</template>`, true)[0];
					internal.component.skip = false;
				}
				else dom.appendChild(ref.html);

				internal.component.skip = false;
				dom.classList.add('page-prepare');
			}

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

			if(ref.cache)
				route.cache = true;

			const hasChild = [];

			for(var keys in ref) {
                if(knownKeys.test(keys))
                	continue;

				hasChild.push(keys);
				addRoutes(ref[keys], current, keys, route);
                break;
            }

            if(hasChild.length !== 0){
            	route.hasChild = hasChild;
            	route.forChild = RegExp(regex);
            }

			routes.push(route);
		}
	}

	if(obj_.constructor !== Array)
		obj_ = [obj_];

    addRoutes(obj_, '', '');
	return routes;
}

internal.router.findRoute = function(url){
	for(let i=0; i<this.length; i++){
		const found = url.match(this[i]);
		if(found !== null){
			const { keys } = this[i];
			if(keys !== void 0){
				const data = this[i].data = {};
				found.shift();

				for (let a = 0; a < keys.length; a++) {
					data[keys[a]] = found[a];
				}
			}

			return this[i];
		}
	}

	return false;
}

const self = sf.views = function View(selector, name){
	if(name === void 0)
		name = slash;

	const self = this;

	if(name)
		sf.views.list[name] = self;

	let pendingAutoRoute = false;

	// Init current URL as current View Path
	if(name === slash)
		self.currentPath = sf.url.paths;
	else if(name === false)
		self.currentPath = '';
	else{
		self.currentPath = '';
		pendingAutoRoute = true;
	}

	let initialized = false;
	let firstRouted = false;

	self.lastPath = '/';
	self.lastDOM = null;
	self.currentDOM = null;
	self.relatedDOM = [];
	self.data = {};

	self.maxCache = 4;
	function removeOldCache(current){
		const parent = current.parentNode;
		if(parent.sf$cachedDOM === void 0)
			parent.sf$cachedDOM = [];

		const i = parent.sf$cachedDOM.indexOf(current);
		if(i === -1)
			parent.sf$cachedDOM.push(current);
		else
			parent.sf$cachedDOM.push(parent.sf$cachedDOM.splice(i, 1)[0]);

		if(self.maxCache < parent.sf$cachedDOM.length)
			parent.sf$cachedDOM.shift().remove();
	}

	let rootDOM = self.rootDOM = {};
	function getSelector(selector_, isChild, currentPath){
		let DOM = (isChild || (rootDOM.isConnected ? rootDOM : document.body)).getElementsByTagName(selector_ || selector);
		if(DOM.length === 0) return false;

		DOM = DOM[0];
		if(DOM.sf$viewInitialized) return false;

		initialized = true;

		if(collection === null)
			collection = DOM.getElementsByTagName('sf-page-view');

		// if(selector_)
		// 	selector = selector_;

		// Create listener for link click
		let temp = null;

		// Bring the content to an sf-page-view element
		if(DOM.childNodes.length !== 0){
			if(DOM.childNodes.length === 1 && DOM.firstChild.nodeName === '#text' && DOM.firstChild.textContent.trim() === '')
				DOM.firstChild.remove();
			else{
				temp = document.createElement('sf-page-view');
				DOM.insertBefore(temp, DOM.firstChild);

				for (let i = 1, n = DOM.childNodes.length; i < n; i++) {
					temp.appendChild(DOM.childNodes[1]);
				}

				temp.routePath = currentPath || self.currentPath;
				temp.routeCached = routes.findRoute(temp.routePath);
				temp.classList.add('page-current');
				DOM.defaultViewContent = temp;
			}
		}

		DOM.sf$viewInitialized = true;

		if(!isChild){
			self.currentDOM = temp;
			rootDOM = self.rootDOM = DOM;
			return true;
		}

		return DOM;
	}

    const selectorList = [selector];
	var routes = self.routes = [];
	routes.findRoute = internal.router.findRoute;

	internal.router.enabled = true;

	const onEvent = {
		'start':[],
		'finish':[],
		'loading':[],
		'loaded':[],
		'error':[]
	};

	self.on = function(event, func){
		if(event.includes(' ')){
			event = event.split(' ');
			for (let i = 0; i < event.length; i++) {
				self.on(event[i], func);
			}

			return self;
		}

		if(onEvent[event] === void 0)
			return console.error(`Event '${event}' was not exist`);

		if(onEvent[event].includes(func) === false)
			onEvent[event].push(func);

		return self;
	}

	self.off = function(event, func){
		if(event.includes(' ')){
			event = event.split(' ');
			for (var i = 0; i < event.length; i++) {
				self.off(event[i], func);
			}

			return self;
		}

		if(onEvent[event] === void 0)
			return console.error(`Event '${event}' was not exist`);

		if(func === void 0){
			onEvent[event].length = 0;
			return self;
		}

		var i = onEvent[event].indexOf(func);
		if(i === -1)
			return self;

		onEvent[event].splice(i, 1);
		return self;
	}

	self.addRoute = function(obj){
		routes.push.apply(routes, internal.router.parseRoutes(obj, selectorList));

		if(!initialized)
			getSelector();

		if(!firstRouted && name){
			$(function(){
				if(firstRouted)
					return;

				if(name === slash && !rootDOM.childElementCount){
					self.currentPath = '';
					firstRouted = self.goto(sf.url.paths);
				}

				if(pendingAutoRoute){
					if(sf.url.hashes[name] !== void 0)
						firstRouted = self.goto(sf.url.hashes[name]);
					else
						firstRouted = self.goto('/');

					if(firstRouted)
						pendingAutoRoute = false;
				}
			});
		}

		return self;
	}

	let RouterLoading = false; // xhr reference if the router still loading

	var collection = null;
	function findRelatedElement(currentURL){
		const found = [];
		for (let i = 0; i < collection.length; i++) {
			if(currentURL.indexOf(collection[i].routePath) === 0)
				found.push(collection[i]);
		}

		return found;
	}

	function findCachedURL(currentURL){
		for (let i = collection.length-1; i >= 0; i--) { // Search from deep view first
			if(currentURL === collection[i].routePath)
				return collection[i];
		}

		return false;
	}

	function routeErrorPassEvent(statusCode, data){
		const ref = onEvent.error;

		if(ref.length === 0){
			console.error('Unhandled router error:', statusCode, data);
			return;
		}

		for (let i = 0; i < ref.length; i++) {
			ref[i](statusCode, data);
		}
	}

	function routeError_(xhr, data){
		if(xhr.aborted) return;
		routingError = true;

		RouterLoading = false;
		routeErrorPassEvent(xhr.status, data);

		window.history.go(routeDirection * -1);
	}

	const pageViewNodeName = 'SF-PAGE-VIEW';
	function toBeShowed(element, event, path, data){
		const relatedPage = [element];

		let parent = element.parentNode;
		while(parent !== rootDOM && parent !== null){
			if(parent.nodeName === pageViewNodeName)
				relatedPage.unshift(parent);

			parent = parent.parentNode;
		}

		let lastSibling = null;
		let parentSimilarity = null;

		for (var i = 0; i < self.relatedDOM.length; i++) {
			if(relatedPage.includes(self.relatedDOM[i]) === false){
				if(lastSibling === null){
					lastSibling = self.relatedDOM[i];
					parentSimilarity = lastSibling.parentNode;
				}

				self.relatedDOM[i].classList.remove('page-current');
			}
		}

		let showedSibling = null;
		for (var i = 0; i < relatedPage.length; i++) {
			if(showedSibling === null && relatedPage[i].parentNode === parentSimilarity)
				showedSibling = relatedPage[i];

			relatedPage[i].classList.add('page-current');
		}

		self.showedSibling = showedSibling;
		self.lastSibling = lastSibling;

		element.classList.add('page-current');

		self.relatedDOM = relatedPage;
	}

	self.removeRoute = function(path){
		const found = routes.findRoute(path);
		if(found === false)
			return;

		for (var i = 0; i < rootDOM.children.length; i++) {
			if(rootDOM.children[i].routePath.match(found))
				rootDOM.children[i].remove();
		}

		var i = routes.indexOf(found);
		if(i === -1)
			return;

		routes.splice(i, 1);
	}

	let routeTotal = 0;
	self.goto = function(path, data, method, callback, _routeCount){
		if(self.currentPath === path)
			return;

		if(initialized === false){
			getSelector();

			if(initialized === false)
				return console.error("sf.views haven't finished initializing, and waiting for related parent element");
		}

		if(_routeCount === void 0){
			for (var i = 0; i < onEvent.start.length; i++)
				if(onEvent.start[i](self.currentPath, path)) return;

			self.lastPath = self.currentPath;
		}

		if(data !== void 0 && data.constructor === Function){
			callback = data;
			data = void 0;
		}

		if(method !== void 0 && method.constructor === Function){
			callback = method;
			method = void 0;
		}

		let dynamicHTML = false;
		if(data instanceof HTMLElement){
			dynamicHTML = data;
			data = void 0;
		}
		if(method instanceof HTMLElement){
			dynamicHTML = method;
			method = void 0;
		}

		pendingAutoRoute = false;

		// Get template URL
		const url = routes.findRoute(path);
		if(!url){
			return routeErrorPassEvent(404, {
				path,
				message:"Path was not found"
			});
		}

		// Return when beforeRoute returned truthy value
		if(url.beforeRoute !== void 0 && url.beforeRoute(url.data))
			return;

		if(name === slash)
			sf.url.paths = path;
		else if(name)
			sf.url.hashes[name] = path;

		// This won't trigger popstate event
		if(!disableHistoryPush && _routeCount === void 0 && name !== false)
			sf.url.push();

		// Check if view was exist
		if(rootDOM.isConnected === false){
			if(rootDOM.nodeType !== void 0)
				rootDOM = {};

			if(getSelector() === false)
				return console.error(name, "can't route to", path, `because element with selector '${selector}' was not found`);
		}

		// Abort other router loading if exist
		if(RouterLoading) RouterLoading.abort();

		// Return if the cache was exist
		if(dynamicHTML === false && tryCache(path)) return true;

		// Count all parent route
		if(_routeCount === void 0){
			routeTotal = 1;
			let routeParent = url.parent;
			while(routeParent !== void 0){
				routeTotal++;
				routeParent = routeParent.parent;
			}
		}

		const currentData = self.data = url.data;

		function insertLoadedElement(DOMReference, dom, pendingShowed){
			dom.routerData = {};
			if(dom.firstChild.nodeName === '#comment' && dom.firstChild.textContent.indexOf(' SF-View-Data') === 0){
				dom.routerData = JSON.parse(dom.firstChild.textContent.slice(14));
				dom.firstChild.remove();

				Object.assign(self.data, dom.routerData);
			}

			// Trigger loaded event
			const rC = routeTotal + 1 - (_routeCount || 1);
			for (var i = 0; i < onEvent.loaded.length; i++) {
				if(onEvent.loaded[i](rC, routeTotal, dom)) return;
			}

			// Let page script running first
			DOMReference.insertAdjacentElement('beforeend', dom);

			if(self.dynamicScript !== false){
				const scripts = dom.getElementsByTagName('script');
				for (var i = 0; i < scripts.length; i++) {
				    gEval(scripts[i].text);
				}
			}

			// Wait if there are some component that being initialized
			// setTimeout(function(){
				const tempDOM = self.currentDOM;
				self.lastDOM = tempDOM;
				self.currentDOM = dom;
				self.currentPath = path;

				if(url.on !== void 0 && url.on.coming)
					url.on.coming(self.data);

				if(url.cache)
					dom.routeNoRemove = true;

				toBeShowed(dom);

				if(pendingShowed !== void 0)
					self.relatedDOM.push.apply(self.relatedDOM, pendingShowed);

				if(tempDOM !== null){
					// Old route
					if(tempDOM.routeCached && tempDOM.routeCached.on !== void 0 && tempDOM.routeCached.on.leaving)
						tempDOM.routeCached.on.leaving(path, url);
				}

				// Save current URL
				dom.routeCached = url;
				dom.routePath = path;

				dom.classList.remove('page-prepare');
				routingError = false;

				// Clear old cache
				removeOldCache(dom);

				if(url.on !== void 0 && url.on.showed)
					url.on.showed(self.data);

				if(tempDOM !== null){
					// Old route
					if(tempDOM.routeCached && tempDOM.routeCached.on !== void 0 && tempDOM.routeCached.on.hidden)
						tempDOM.routeCached.on.hidden(path, url);
				}
			// });
		}

		const afterDOMLoaded = function(dom){
			if(url.selector || url.hasChild){
				var selectorElement = dom.sf$viewSelector;

				if(selectorElement === void 0)
					selectorElement = dom.sf$viewSelector = {};
			}

			if(hotReload && url.template !== void 0)
				dom.sf$templatePath = url.template;

			if(url.hasChild){
				var pendingShowed = [];
				for (var i = 0; i < url.hasChild.length; i++) {
					selectorElement[url.hasChild[i]] = getSelector(url.hasChild[i], dom, path);
					const tempPageView = selectorElement[url.hasChild[i]].firstElementChild;

					if(tempPageView)
						pendingShowed.unshift(tempPageView);
				}

				if(pendingShowed.length === 0)
					pendingShowed = void 0;
			}
			else var pendingShowed = void 0;

			if(url.selector === void 0)
				var DOMReference = rootDOM;
			else{ // Get element from selector
				const selectorName = selectorList[url.selector];
				var DOMReference = null;

				const last = findRelatedElement(path);

				// Find current parent
				for (var i = 0; i < last.length; i++) {
					const found = last[i].sf$viewSelector;
					if(found === void 0 || found[selectorName] === void 0)
						continue;

					DOMReference = found[selectorName];
				}

				if(!DOMReference || DOMReference.isConnected === false){
					if(url.parent === void 0){
						dom.remove();
						return routeError_({status:0}, {
							path,
							target:dom,
							message:"Parent element was not found while adding this element. Maybe it was disconnected from the DOM."
						});
					}
					else{
						// Try to load parent router first
						const newPath = path.match(url.parent.forChild)[0];
						return self.goto(newPath, false, method, function(parentNode){
							DOMReference = parentNode.sf$viewSelector[selectorName];

							if(currentData !== self.data)
								self.data = Object.assign(currentData, self.data);

							insertLoadedElement(DOMReference, dom);
							if(callback) return callback(dom);

							if(dom.routerData)
								self.data = dom.routerData;
							else if(dom.parentElement !== null){
								const parent = dom.parentElement.closest('sf-page-view');
								if(parent !== null)
									self.data = parent.routerData;
							}

							for (let i = 0; i < onEvent.finish.length; i++)
								onEvent.finish[i](self.lastPath, path);

							const { defaultViewContent } = dom.parentNode;
							if(defaultViewContent !== void 0 && defaultViewContent.routePath !== path)
								defaultViewContent.classList.remove('page-current');
						}, _routeCount + 1 || 2);
					}
				}
			}

			insertLoadedElement(DOMReference, dom, pendingShowed);
			if(callback) return callback(dom);

			if(dom.routerData)
				self.data = dom.routerData;
			else if(dom.parentElement !== null){
				const parent = dom.parentElement.closest('sf-page-view');
				if(parent !== null)
					self.data = parent.routerData;
			}

			for (var i = 0; i < onEvent.finish.length; i++)
				onEvent.finish[i](self.lastPath, path);
		}

		if(dynamicHTML !== false){
			afterDOMLoaded(dynamicHTML);
			return true;
		}

		//(url.url || path)
		if(url.templateURL !== void 0 && cachedURL[url.templateURL] !== void 0){
			afterDOMLoaded(cachedURL[url.templateURL].cloneNode(true));
			return true;
		}

		if(url.template && url.html === void 0){
			if(window.templates === void 0)
				return console.error("`window.templates` was not found");

			// Create new element
			url.html = sf.dom.parseElement(`<template>${window.templates[url.template+'.html']}</template>`, true)[0];

			if(hotReload)
				url.template = url.template+'.html';
		}

		if(url.html){
			if(url.html.nodeName === 'TEMPLATE'){
				const node = document.createElement('sf-page-view');
				node.classList.add('page-prepare');

				const clone = url.html.cloneNode(true).content.childNodes;
				for(let p=0, n=clone.length; p < n; p++){
					node.insertBefore(clone[0], null);
				}

				afterDOMLoaded(node);
				return true;
			}

			afterDOMLoaded(url.html.cloneNode(true));
			return true;
		}

		let thePath = (url.templateURL || url.url || path);
		if(thePath[0] !== '/')
			thePath = `/${thePath}`;

		for (var i = 0; i < onEvent.loading.length; i++)
			if(onEvent.loading[i](_routeCount || 1, routeTotal)) return;

		RouterLoading = sf.request(
			method || 'GET',
			window.location.origin + thePath,
			Object.assign(data || url.defaultData, {
		        _sf_view:url.selector === void 0 ? selector : selectorList[url.selector].split(' ').pop()
		    })
		)
		.done(function(html_content){
			if(rejectResponse.test(html_content)){
				return routeError_({status:403}, {
					path,
					requestURL:window.location.origin + thePath,
					message:"Views request was received <html> while it was disallowed. Please check http response from Network Tab."
				});
			}

			// Create new element
			const dom = document.createElement('sf-page-view');
			dom.classList.add('page-prepare');

			var elements = sf.dom.parseElement(html_content);
			for(var p=0, n=elements.length; p < n; p++){
				dom.insertBefore(elements[0], null);
			}

			// Same as above but without the component initialization
			if(url.templateURL !== void 0){
				internal.component.skip = true;
				const temp = document.createElement('sf-page-view');
				temp.classList.add('page-prepare');

				var elements = sf.dom.parseElement(html_content);
				for(var p=0, n=elements.length; p < n; p++){
					temp.insertBefore(elements[0], null);
				}

				cachedURL[url.templateURL] = temp;
				internal.component.skip = false;
			}

			afterDOMLoaded(dom);
		})
		.fail(routeError_);
		return true;
	}

	// Use cache if exist
	function tryCache(path){
		let cachedDOM = false;

		function findDOM(dom){
			if(dom === null)
				return false;

			cachedDOM = findCachedURL(path);
			if(cachedDOM)
				return true;

			const childs = dom.children;
			for (let i = 0; i < childs.length; i++) {
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

		self.lastDOM = self.currentDOM;
		if(self.currentDOM.routeCached.on !== void 0 && self.currentDOM.routeCached.on.leaving)
			self.currentDOM.routeCached.on.leaving();

		self.currentDOM = cachedDOM;

		if(cachedDOM.routerData)
			self.data = cachedDOM.routerData;
		else if(cachedDOM.parentElement !== null){
			const parent = cachedDOM.parentElement.closest('sf-page-view');
			if(parent !== null)
				self.data = parent.routerData;
		}

		if(self.currentDOM.routeCached.on !== void 0 && self.currentDOM.routeCached.on.coming)
			self.currentDOM.routeCached.on.coming(self.data);

		self.currentPath = self.currentDOM.routePath;

		toBeShowed(cachedDOM);

		for(var i = 0; i < onEvent.finish.length; i++)
			onEvent.finish[i](self.lastPath, self.currentPath);

		if(self.currentDOM.routeCached.on !== void 0 && self.currentDOM.routeCached.on.showed)
			self.currentDOM.routeCached.on.showed(self.data);

		if(self.lastDOM.routeCached.on !== void 0 && self.lastDOM.routeCached.on.hidden)
			self.lastDOM.routeCached.on.hidden();

		return true;
	}

	return self;
};

self.list = {};
self.goto = function(url){
	const parsed = sf.url.parse(url);
	sf.url.data = parsed.data;

	const views = self.list;

	for(let list in self.list){
		// For root path
		if(list === slash){
			if(views[slash].currentPath !== parsed.paths)
				views[slash].goto(parsed.paths);

			continue;
		}

		// For hash path
		if(parsed.hashes[list] !== views[list].currentPath)
			views[list].goto(parsed.hashes[list] || '/');
	}
}

// Listen to every link click, capture mode
$(function(){
	if(sf.views.onCrossing === void 0)
		sf.views.onCrossing = function(url, target){
			console.error("Unhandled crossing URL origin", url, target);
			console.warn("Handle it by make your custom function like `sf.views.onCrossing = func(){}`");
		};

	$.on(document.body, 'click', 'a[href]', function(ev){
		ev.preventDefault();

		const attr = this.getAttribute('href');
		if(attr[0] === '@'){ // ignore
			const target = this.getAttribute('target');
			if(target)
				window.open(attr.slice(1), target);
			else window.location = attr.slice(1);
			return;
		}

		// Make sure it's from current origin
		const path = this.href.replace(window.location.origin, '');

		// If it's different domain
		if(path.includes('//')){
			sf.views.onCrossing(this.href, this.getAttribute('target'));
			return;
		}

		// Let ScarletsFrame handle this link
		self.goto(attr);
	}, true);
});

})();
// If you learn/copy from this library or rewrite it to your code
// You must credit me on your code. I was struggling alone for many
// day to make this working since using scroll event :(

// ToDo: add sf$scrollPos and sf$heightPos
const ElementManipulatorProxy = internal.EMP;
const ElementManipulator = internal.EM;
const VSM_Threshold = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

class VirtualScrollManipulator {
	waitMap = new Set();
	existMap = new WeakSet();
	observeMap = new WeakSet();
	waitingMap = false;
	dynamicSize = false;
	firstCursor = 0;
	lastCursor = 0;
	bottomHeight = 1;
	topHeight = 1;
	prepareSize = 12/2;
	totalHeight = 0;

	constructor(root, $EM, firstEl){
		this.$EM = $EM;
		this.elList = $EM.elements;
		this.list = $EM.list;
		this.iTop = document.createElement(firstEl.tagName);
		this.iTop.classList.add('virtual-spacer');
		this.iRoot = root;
		this.iBottom = this.iTop.cloneNode();

		root.insertBefore(this.iTop, null);
		root.appendChild(this.iBottom);
		root.insertBefore(firstEl, this.iBottom);

		const styled = window.getComputedStyle(firstEl);
		this.elMargin = Number(styled.marginBottom.slice(0, -2)) + Number(styled.marginTop.slice(0, -2));

		this.elMaxHeight = this.elHeight = firstEl.offsetHeight + this.elMargin;
		firstEl.remove();

		const that = this;
		requestAnimationFrame(function(){
			setTimeout(function(){
				if(!root.isConnected) return; // Somewhat it's detached

				let scroller = internal.findScrollerElement(root);
				if(scroller === null){
					scroller = root;
					console.warn("Virtual List need scrollable container", root);
				}
				else scroller.classList.add('sf-scroll-element');
				that.iScroller = scroller;

				that.rootHeight = that.iScroller.offsetHeight;

				if(root.classList.contains('sf-list-dynamic'))
					that.dynamicSize = true;

				that.init();
			}, 500);
		});
	}

	init(){
		this.listSize = this.prepareSize + Math.round(this.rootHeight / this.elMaxHeight);

		const that = this;
		function intersectionCallback(){
			const entries = that.lastEntries;
			that.lastEntries = void 0;

			let refreshed = false;
			for(let i=entries.length-1; i>=0; i--){
				const entry = entries[i];
				if(entry.intersectionRect.height <= 1)
					continue;

				if(entry.target === that.iTop || entry.target === that.iBottom){
					if(entry.isIntersecting === false || refreshed)
						continue;

					refreshed = true;
					that.recalculateScrollPosition();
				}
				else if(that.observeMap.has(entry.target))
					that.waitObservedElement(entry.target, entry.intersectionRatio);
			}
		}

		this.observer = new IntersectionObserver(function(entries){
			if(that.lastEntries === void 0)
				requestAnimationFrame(intersectionCallback);
			that.lastEntries = entries;
		}, {
			root: that.iScroller,
			threshold: VSM_Threshold
		});

		this.observer.observe(this.iTop);
		this.observer.observe(this.iBottom);

		if(this.dynamicSize){
			this.rObserver = new ResizeObserver(function(entries){
				const { elList } = that;
				let refresh = elList.length;

				for(var i=0; i<entries.length; i++){
					var el = entries[i].target;
					const newHeight = el.offsetHeight + that.elMargin;

					if(el.sf$heightPos !== newHeight){
						that.totalHeight -= el.sf$heightPos;
						that.totalHeight += newHeight;
						el.sf$heightPos = newHeight;

						const index = elList.indexOf(el);
						if(index !== -1 && refresh > index)
							refresh = index;

						if(newHeight > that.elMaxHeight)
							that.elMaxHeight = newHeight;
					}
				}

				that.listSize = that.prepareSize + Math.round(that.rootHeight / that.elMaxHeight);

				if(refresh === 0)
					elList[refresh++].sf$scrollPos = 1;

				for(var i=refresh; i<elList.length; i++){
					const before = elList[i-1];
					var el = elList[i];
					if(before === void 0){
						el.sf$scrollPos = 1;
						continue;
					}

					el.sf$scrollPos = before.sf$scrollPos + before.sf$heightPos;
				}

				if(that.lastCursor !== elList.length){
					var el = elList[that.lastCursor];
					that.bottomHeight = that.totalHeight - (el.sf$scrollPos + el.sf$heightPos);

					if(that.bottomHeight < 0)
						that.bottomHeight = 2;
				}
				else that.bottomHeight = 1;

				that.iBottom.style.height = that.bottomHeight+'px';
			});

			this.bottomHeight = 2;
		}
		else this.bottomHeight = this.elMaxHeight * this.elList.length;

		this.iTop.style.height = this.topHeight+'px';
		this.iBottom.style.height = this.bottomHeight+'px';
	}

	waitObservedElement(el, ratio){
		if(ratio < 0.7){
			this.waitMap.delete(el);
			if(this.existMap.has(el)){
				this.existMap.delete(el);
				this.list.visibilityCallback(elList.indexOf(el), false);
			}
		}
		else if(!this.existMap.has(el))
			this.waitMap.add(el);

		if(this.waitingMap === false){
			setTimeout(this.waitObservedFinish, 1000);
			this.waitingMap = true;
		}
	}

	waitObservedFinish(){
		const startMark = this.iScroller.scrollTop;
		const endMark = startMark + this.iScroller.offsetHeight;

		for(let val of waitMap){
			if(val.sf$scrollPos < startMark || val.sf$scrollPos > endMark)
				continue;

			this.existMap.add(val);
			this.list.visibilityCallback(elList.indexOf(el), true);
		}

		this.waitMap.clear();
		this.waitingMap = false;
	}

	recalculateScrollPosition(){
		if(this.listSize === void 0)
			return; // Haven't been initialized

		const { scrollTop } = this.iScroller;
		const { elList } = this;

		for(var i = Math.floor(scrollTop/this.elMaxHeight); i < elList.length; i++){
			const scrollPos = elList[i].sf$scrollPos;
			if(scrollPos === void 0 || scrollPos >= scrollTop)
				break;
		}

		i = i - this.prepareSize;
		if(i < 0) i=0;
		else if(i > elList.length) i = elList.length - this.listSize;

		let until = i + this.listSize + this.prepareSize;
		if(until > elList.length) until = elList.length;

		if(i >= until){
			this.iBottom.style.height = this.bottomHeight+'px';
			return;
		}

		this.firstCursor = i;

		const expect = elList[i] || null;
		let next = this.iTop.nextElementSibling;
		let last;

		while(next !== expect){
			last = next;
			last.sf$removed = true;
			next = last.nextElementSibling;

			if(next !== this.iBottom){
				next = this.iTop;
				break;
			}

			last.remove();
			if(this.dynamicSize)
				this.rObserver.unobserve(last);
		}

		this.topHeight = expect.sf$scrollPos;

		for(; i < until; i++){
			last = elList[i];
			next.insertAdjacentElement('afterEnd', last);

			if(last.sf$removed && this.dynamicSize)
				this.rObserver.observe(last);

			last.sf$removed = false;
			next = last;
		}

		next = next.nextElementSibling;

		while(next !== this.iBottom){
			last = next;
			last.sf$removed = true;
			next = last.nextElementSibling;
			last.remove();

			if(this.dynamicSize)
				this.rObserver.unobserve(last);
		}

		last = elList[until];
		this.lastCursor = until;

		if(i === elList.length)
			this.bottomHeight = 1;
		else
			this.bottomHeight = this.totalHeight - (last.sf$scrollPos + last.sf$heightPos);

		if(this.bottomHeight < 0) this.bottomHeight = 2;

		this.iTop.style.height = this.topHeight+'px';
		this.iBottom.style.height = this.bottomHeight+'px';
	}

	observeVisibility(index){
		this.observer.observe(this.elList[index]);
		this.observeMap.add(this.elList[index]);
	}

	unobserveVisibility(index){
		this.observer.unobserve(this.elList[index]);
		this.observeMap.delete(this.elList[index]);
	}

	scrollTo(index){
		const target = this.elList[index];
		if(!target) return;

		this.iScroller.scrollTop = target.sf$scrollPos;
	}

	offsetTo(index){
		if(!this.elList[index]) return -1;
		return this.elList[index].sf$scrollPos;
	}
}

// For repeated-list.js
Object.assign(VirtualScrollManipulator.prototype, {
	startInjection(){
		// console.log(this.elList);
		const { elList } = this;
		let n = this.listSize;
		if(n > elList.length)
			n = elList.length;

		for (let i = 0; i < n; i++){
			this.iRoot.insertBefore(elList[i], this.iBottom);
			this.newElementInit(elList[i], i-1);
		}

		this.firstCursor = 0;
		this.lastCursor = n;

		if(elList.length === n)
			this.bottomHeight = 1;
		else this.bottomHeight = 2;
		this.topHeight = 1;
	},

	newElementInit(el, before){
		if(el.sf$heightPos === void 0)
			el.sf$heightPos = this.elHeight + this.elMargin;

		if(before === 0)
			el.sf$scrollPos = 1;
		else{
			before = this.elList[before];
			if(before !== void 0)
				el.sf$scrollPos = before.sf$scrollPos + before.sf$heightPos;
			else el.sf$scrollPos = 1;
		}

		if(this.dynamicSize)
			this.rObserver.observe(el);

		this.totalHeight += el.sf$heightPos;
	},

	clear(){
		this.topHeight = this.bottomHeight = 1;
		this.totalHeight = this.lastCursor = this.firstCursor = 0;

		if(this.dynamicSize)
			this.rObserver.disconnect();

		this.waitMap.clear();
		this.iRoot.appendChild(this.iTop);
		this.iRoot.appendChild(this.iBottom);
	},

	append(index){
		this.recalculateScrollPosition();
	},

	prepend(index){
		this.recalculateElementData(index);
		this.recalculateScrollPosition();
	},

	move(from, to, count, vDOM){
		if(to < from)
			from = to;

		this.recalculateElementData(from);
		this.recalculateScrollPosition();
	},

	swap(index, other){
		if(other < index)
			index = other;

		this.recalculateElementData(index);
		this.recalculateScrollPosition();
	},

	remove(index){
		this.totalHeight -= this.elList[index].sf$heightPos;
		this.recalculateElementData(index);
		this.recalculateScrollPosition();
	},

	removeRange(index, other){
		for (let i = index; i < other; i++) {
			this.totalHeight -= this.elList[i].sf$heightPos;
		}

		this.elList.splice(index, other-index);
		this.recalculateElementData(index);
		this.recalculateScrollPosition();
	},

	insertAfter(index){
		this.totalHeight -= this.elList[index].sf$heightPos;
		this.recalculateScrollPosition();
	},

	update(i, temp){
		this.recalculateScrollPosition();
	},

	hardRefresh(index){
		this.recalculateElementData(index);
		this.recalculateScrollPosition();
	},

	reverse(){
		this.recalculateElementData(0);
		this.recalculateScrollPosition();
	},

	recalculateElementData(index){
		const { elList } = this;
		for (let i = index+1; i < elList.length; i++) {
			const before = elList[i-1];
			const now = elList[i];
			now.sf$scrollPos = before.sf$scrollPos + before.sf$heightPos;
		}
	},
});

class VirtualScroll{
	constructor($EM){
		this.$EM = $EM;
	}

	visibilityCallback = function(){
		console.log('Please set "visibilityCallback" property when using "observeVisibility"');
	}

	_proxying(name, args){
		if(this.$EM.constructor === ElementManipulatorProxy){
			const { list } = this.$EM;
			let val;
			for (let i = 0; i < list.length; i++)
				val = VirtualScrollManipulator.prototype[name].apply(list[i].$VSM, args);
			return val;
		}
		else return VirtualScrollManipulator.prototype[name].apply(this.$EM.$VSM, args);
	}

	observeVisibility(index){
		this._proxying('observeVisibility', arguments);
	}

	unobserveVisibility(index){
		this._proxying('unobserveVisibility', arguments);
	}

	scrollTo(index){
		this._proxying('scrollTo', arguments);
	}

	offsetTo(index){
		return this._proxying('offsetTo', arguments);
	}

	destroy(){
		// console.log("VirtualScroll destroy haven't been implemented");
	}
}

;(function(){
	let styleInitialized = false;
	internal.addScrollerStyle = function(){
		if(styleInitialized === false){
			let style = document.getElementById('sf-styles');

			if(!style){
				style = document.createElement('style');
				style.id = 'sf-styles';
				document.head.appendChild(style);
			}

			style.sheet.insertRule(
			'.sf-virtual-list .virtual-spacer{'+
				'visibility: hidden !important;'+
				'position: relative !important;'+
				'transform-origin: 0 0 !important;'+
				'width: 1px !important;'+
				'margin: 0 !important;'+
				'padding: 0 !important;'+
				'background: none !important;'+
				'border: none !important;'+
				'box-shadow: none !important;'+
				'transition: none !important;'+
			 '}', style.sheet.cssRules.length);

			style.sheet.insertRule(
			'.sf-scroll-element {'+
				'backface-visibility: hidden;'+
			'}', style.sheet.cssRules.length);
			styleInitialized = true;
		}
	}

	const isScroller = /auto|scroll|overlay|hidden/;
	internal.findScrollerElement = function(el){
		const doc = el.ownerDocument;
		const win = doc.defaultView;
		if(!win) return null;

		while(el !== null && isScroller.test(win.getComputedStyle(el).overflow) === false){
			el = el.parentNode;
			if(el === doc.body)
				return null;
		};

		return el;
	}
})();
// This feature is not designed for remote browser
// For using as remote, developer should build
// their own auth or communication system

let headerTags = '';
let windowDestroyListener = false;

function winDestroy(win){
	const opt = win.winOptions;
	if(opt.onclose && opt.onclose() === false){
		ev.preventDefault();
		return false;
	}

	win.destroying = true;

	delete sf.window.list[opt.id];
	win.document.body.remove();
	win.close();
	console.log(`%c[${opt.title}]`, "color: #9bff82", "Closed!");
}

const reqAnimFrame = window.requestAnimationFrame;
function firstInitSFWindow(){
	window.addEventListener('focus', function(){
		window.requestAnimationFrame = reqAnimFrame;
	});
}

sf.window = {
	list:{},
	destroy(id){
		if(id !== void 0)
			winDestroy(this.list[id]);
		else{
			const { list } = this;
			for(let k in list)
				winDestroy(list[k]);
		}

		window.requestAnimationFrame = reqAnimFrame;
	},
	create(options, onLoaded){
		if(options === void 0)
			options = {};

		if(options.id === void 0)
			options.id = Math.round(Math.random()*1000) + String(Date.now()).slice(3);

		const winID = options.id;
		if(windowDestroyListener === false){
			windowDestroyListener = true;
			window.addEventListener('beforeunload', function(){
				sf.window.destroy();
			});
		}

		let template;
		if(options.templateHTML)
			template = options.templateHTML;
		else if(options.templatePath)
			template = window.templates[options.templatePath];
		else if(options.templateURL)
			console.log("Haven't been implemented");
		else console.error("The options must have a template (templatePath | templateHTML | templateURL)");

		if(template === void 0)
			return console.error("Template not found") && false;

		const windowFeatures = `width=${options.width || 500},height=${options.height || 400}`;
		const linker = window.open(window.location.origin+(options.route || ''), '', windowFeatures);

		if(linker === null)
			return console.error("It seems the popup was blocked by the browser") && false;

		if(headerTags === ''){
			headerTags = $('script[src*="scarletsframe"]')[0].outerHTML;
			const styles = $('link, style');

			for (let i = 0; i < styles.length; i++)
				headerTags += styles[i].outerHTML;
		}

		linker.winOptions = options;

		const windows = this.list;
		linker.loaded = function(){
			windows[winID] = linker;

			linker.sf.space.list = sf.space.list;

			// Proxying
			linker.sf.model.root = sf.model.root;
			linker.sf.model.init = sf.model.init;
			linker.sf.component.new = sf.component.new;
			linker.sf.lang.init = sf.lang.init;
			linker.sf.lang.changeDefault = sf.lang.changeDefault;

			// Component
			portComponentDefinition(linker, sf.component.registered, linker.sf.component.registered);

			const spaces = sf.space.list;
			for(let name in spaces){
				const space = spaces[name];
				const ref = new linker.sf.space(name, {
					templatePath: space.templatePath
				});

				// Model
				for(let id in space.list)
					ref.list[id].root = space[id].root;

				// Component
				portComponentDefinition(linker, space.default.registered, ref.default.registered);
			}

			linker.document.body.textContent = '';
			$(linker.document.body).append(template);
			linker.sf$proxy.sfLoaderTrigger();

			if(firstInitSFWindow){
				firstInitSFWindow();
				firstInitSFWindow = void 0;
			}

			if(document.hasFocus() === false)
				window.requestAnimationFrame = linker.requestAnimationFrame;

			linker.addEventListener('focus', function(){
				window.requestAnimationFrame = linker.requestAnimationFrame;
			});

			onLoaded && onLoaded({
				views: linker.sf.views,
				url: linker.sf.url
			});

			sf.lang.init(linker.document.body);

			for(let ev in windowEv){
				const callbackList = windowEv[ev];
				for (let i = 0; i < callbackList.length; i++) {
					const evCallback = callbackList[i];
					linker.addEventListener(ev, evCallback, evCallback.options);
				}
			}
		}

		if(options.title === void 0)
			options.title = "Untitled Space";

		linker.console.log = function(){
			console.log(`%c[${options.title}]`, "color: #9bff82", ...arguments);
		}

		linker.console.warn = function(){
			console.warn(`%c[${options.title}]`, "color: #9bff82", ...arguments);
		}

		linker.console.error = function(){
			console.error(`%c[${options.title}]`, "color: #9bff82", ...arguments);
		}

		linker.sf$proxy = forProxying;

		linker.onerror = linker.onmessageerror = linker.console.error;
		linker.document.write(`<html><head><title>${
			options.title}</title>${headerTags
		}</head><body><script>setTimeout(loaded,1000)</script></body></html>`);

		linker.addEventListener('beforeunload', function(ev){
			sf.window.destroy(winID);
		});

		return true;
	},
	source(lists, ev){
		if(ev === void 0)
			ev = window.event;

		if(ev === void 0)
			throw new Error("Can't capture event, please add event data on parameter 2 of sf.window.source");

		if(lists === void 0)
			return lists.view;

		const doc = ev.view.document;
		for (let i = 0; i < lists.length; i++) {
			if(lists[i].ownerDocument === doc)
				return lists[i];
		}

		return null;
	}
};

var windowEv = {};

function portComponentDefinition(linker, from, into){
	for(let name in from){
		const ref = into[name] = from[name].slice(0);

		if(ref[3] !== void 0){
			if(ref[3].constructor === Object){
				const template = Object.create(ref[3]);
				ref[3] = template;
				template.html = $.parseElement(template.html.outerHTML)[0];
			}
			else{
				const { tempDOM } = ref[3];
				ref[3] = $.parseElement(ref[3].outerHTML)[0];
				ref[3].tempDOM = tempDOM;
			}
		}

		ref[1] = linker.sf$defineComponent(name);
	}
}
return sf;

// ===== Module End =====
})));