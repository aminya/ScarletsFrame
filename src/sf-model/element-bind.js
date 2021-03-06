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