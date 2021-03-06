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