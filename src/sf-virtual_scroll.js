sf.internal.virtual_scroll = new function(){
	var self = this;

	// before and after
	self.prepareCount = 4; // 4, 8, 12, 16, ...
	self.dynamicPrepareCount = 8; // 4, 8, 12, 16, ...

	self.handle = function(list, targetNode, parentNode){
		list.$virtual.dCursor = { // DOM Cursor
			ceiling:parentNode.querySelector('.virtual-spacer.ceiling'),
			floor:parentNode.querySelector('.virtual-spacer.floor')
		};

		list.$virtual.bounding = {
			ceiling:0,
			floor:0
		}

		list.$virtual.vCursor = { // Virtual Cursor
			ceiling:null, // for forward direction
			floor:null // for backward direction
		}

		list.$virtual.targetNode = parentNode;
		list.$virtual.DOMCursor = 0; // cursor of first element in DOM tree as a cursor

		list.$virtual.scrollHeight = 
			list.$virtual.dCursor.floor.offsetTop - 
			list.$virtual.dCursor.ceiling.offsetTop;

		var scroller = null;
		list.$virtual.destroy = function(){
			$(scroller).off();
			$(parentNode).off();
			list.$virtual.dom.innerHTML = '';
			delete list.$virtual;
		}

		list.$virtual.resetViewport = function(){
			list.$virtual.visibleLength = Math.floor(scroller.clientHeight / list.$virtual.scrollHeight);
			list.$virtual.preparedLength = list.$virtual.visibleLength + self.prepareCount * 2;
		}

		setTimeout(function(){
			if(parentNode.parentElement.classList.contains('simplebar-content'))
				scroller = parentNode.parentElement;
			else scroller = parentNode;

			list.$virtual.resetViewport();
			
			if(parentNode.classList.contains('sf-list-dynamic'))
				dynamicHeight(list, targetNode, parentNode, scroller);
			else
				staticHeight(list, targetNode, parentNode, scroller);
		}, 500);
	}

	// Recommended for a list that have different element height
	function dynamicHeight(list, targetNode, parentNode, scroller){
		var ceiling = list.$virtual.dCursor.ceiling;
		var floor = list.$virtual.dCursor.floor;

		// Insert some element until reach visible height
		var i = null;
		do{
			i = list.$virtual.dom.firstElementChild;
			if(i === null) break;

			floor.insertAdjacentElement('beforeBegin', i);
		} while(i.scrollTop < scroller.clientHeight);
		
		var bounding = virtual.bounding;

		refreshScrollBounding(self.prepareCount, bounding, list, parentNode);

		function checkCursorPosition(){
			if(updating || scroller.scrollTop >= bounding.ceiling && scroller.scrollTop <= bounding.floor)
				return;

			if(list.$virtual.DOMCursor + self.prepareCount > list.length) return;
		}

		$(scroller).on('scroll', checkCursorPosition);
	}

	// Recommended for a list that have similar element height
	function staticHeight(list, targetNode, parentNode, scroller){
		var virtual = list.$virtual;
		var ceiling = virtual.dCursor.ceiling;
		var floor = virtual.dCursor.floor;

		// Insert visible element to dom tree
		var insertCount = virtual.preparedLength <= list.length ? virtual.preparedLength : list.length;
		for (var i = 0; i < insertCount; i++) {
			floor.insertAdjacentElement('beforeBegin', virtual.dom.firstElementChild);
		}

		function refreshVirtualSpacer(cursor){
			if(cursor >= self.prepareCount){
				ceiling.style.height = (cursor - self.prepareCount) * virtual.scrollHeight + 'px';
				floor.style.height = (list.length - virtual.preparedLength - cursor) * virtual.scrollHeight + 'px';
			}
			else{
				ceiling.style.height = cursor * virtual.scrollHeight + 'px'; //'0px';
				floor.style.height = list.length * virtual.scrollHeight + 'px';
			}
		}

		var bounding = virtual.bounding;

		refreshVirtualSpacer(0);
		refreshScrollBounding(self.prepareCount, bounding, list, parentNode);
		bounding.ceiling = -1;

		virtual.offsetTo = function(index){
			return index * virtual.scrollHeight + ceiling.offsetTop;
		}

		var vCursor = list.$virtual.vCursor;
		vCursor.floor = virtual.dom.firstElementChild;
		virtual.scrollTo = function(index){
			scrollTo(index, list, self.prepareCount, parentNode, scroller, refreshVirtualSpacer);
		}

		virtual.refresh = function(force){
			var cursor = virtual.DOMCursor;

			// Force move cursor if element in the DOM tree was overloaded
			if(force || parentNode.childElementCount - 2 > virtual.preparedLength){
				virtual.DOMCursor = list.length;
				scrollTo(cursor <= self.prepareCount ? cursor : (cursor + self.prepareCount),
					list,
					self.prepareCount,
					parentNode,
					scroller,
					refreshVirtualSpacer
				);
			}

			refreshVirtualSpacer(cursor);
			checkCursorPosition();
			refreshScrollBounding(cursor, bounding, list, parentNode);
		}

		var updating = false;
		var fromCeiling = true;
		var scrollFocused = false;
		function checkCursorPosition(){
			if(updating || scroller.scrollTop >= bounding.ceiling && scroller.scrollTop <= bounding.floor){
				// Fix chrome scroll anchoring bugs when scrolling at corner
				if(scrollFocused){
					if(scroller.scrollTop === 0 || scroller.scrollTop === scroller.scrollHeight - scroller.clientHeight){
						removeUserScrollFocus(scroller);
						scrollFocused = false;
					}
				}
				return;
			}

			var cursor = Math.floor(scroller.scrollTop / virtual.scrollHeight);
			if(cursor + virtual.preparedLength > list.length)
				cursor = list.length - virtual.preparedLength;

			if(fromCeiling){
				if(cursor < self.prepareCount*2)
					cursor -= self.prepareCount;

				// Fix chrome scroll anchoring bugs
				if(scrollFocused){
					removeUserScrollFocus(scroller);
					scrollFocused = false;
				}
				fromCeiling = false;
			}

			if(cursor < self.prepareCount){
				cursor = 0;
				fromCeiling = true;
			}

			updating = true;

			var changes = cursor - virtual.DOMCursor;
			if(cursor + changes >= list.length)
				changes = cursor + changes - list.length;

			if(changes === 0){ // This should be fixed to improve performance and future bugs
				//console.warn("No changes (The scroll bounding is not correct)");
				updating = false;
				return;
			}

			virtual.DOMCursor = cursor;

			//console.log(cursor, changes);

			//console.log(cursor, changes, bounding.ceiling, bounding.floor, scroller.scrollTop);
			moveElementCursor(changes, list);
			refreshVirtualSpacer(cursor);
			refreshScrollBounding(cursor, bounding, list, parentNode);
			//console.log('a', bounding.ceiling, bounding.floor, scroller.scrollTop);

			updating = false;
		}

		$(scroller).on('scroll', checkCursorPosition);

		// For preventing scroll jump if scrolling over than viewport
		if(scroller === parentNode && navigator.userAgent.indexOf('Chrom') !== -1){
			$(parentNode).on('mousedown', function(){
				scrollFocused = true;
			});
			$(parentNode).on('mouseup', function(){
				scrollFocused = false;
			});
		}
	}

	function refreshScrollBounding(cursor, bounding, list, parentNode){
		var temp = Math.floor(self.prepareCount / 2); // half of element preparation
		if(cursor < self.prepareCount){
			bounding.ceiling = -1;
			bounding.floor = parentNode.children[self.prepareCount * 2 + 1].offsetTop;
			return;
		}
		else bounding.ceiling = parentNode.children[temp + 1].offsetTop; // -2 element

		if(list.$virtual.preparedLength !== undefined && cursor >= list.length - list.$virtual.preparedLength)
			bounding.floor = list.$virtual.dCursor.floor.offsetTop + list.$virtual.scrollHeight*2;
		else
			bounding.floor = parentNode.children[self.prepareCount + 3].offsetTop; // +2 element
	}

	function moveElementCursor(changes, list){
		var vDOM = list.$virtual.dom;
		var vCursor = list.$virtual.vCursor;
		var dCursor = list.$virtual.dCursor;

		if(changes > 0){ // forward
			var ref = 0;

			// Select from virtual ceiling cursor to Dom tree
			for (var i = 0; i < changes; i++) { // vDom -> Dom tree
				if(vCursor.ceiling === null)
					ref = vDOM.firstElementChild;

				else ref = vCursor.ceiling.nextElementSibling;
				dCursor.floor.insertAdjacentElement('beforeBegin', ref);
			}

			// Move element on the ceiling to vDom
			for (var i = changes; i > 0; i--) { // Dom tree -> vDom
				if(vCursor.ceiling === null){
					vCursor.ceiling = dCursor.ceiling.nextElementSibling;
					vDOM.insertAdjacentElement('afterBegin', vCursor.ceiling);
				}
				else{
					ref = dCursor.ceiling.nextElementSibling;
					vCursor.ceiling.insertAdjacentElement('afterEnd', ref);
					vCursor.ceiling = ref;
				}
			}

			vCursor.floor = vCursor.ceiling.nextElementSibling;
		}
		else if(changes < 0){ // backward
			var ref = 0;
			changes = -changes;

			// Select from virtual floor cursor to Dom tree
			for (var i = 0; i < changes; i++) { // vDom -> Dom tree
				if(vCursor.floor === null)
					ref = vDOM.lastElementChild;

				else ref = vCursor.floor.previousElementSibling;
				dCursor.ceiling.insertAdjacentElement('afterEnd', ref);
			}

			// Move element on the floor to vDom
			for (var i = 0; i < changes; i++) { // Dom tree -> vDom
				if(vCursor.floor === null){
					vCursor.floor = dCursor.floor.previousElementSibling;
					vDOM.insertAdjacentElement('beforeEnd', vCursor.floor);
				}

				else{
					ref = dCursor.floor.previousElementSibling;
					vCursor.floor.insertAdjacentElement('beforeBegin', ref);
					vCursor.floor = ref;
				}
			}

			vCursor.ceiling = vCursor.floor.previousElementSibling;
		}
	}

	function scrollTo(index, list, prepareCount, parentNode, scroller, refreshVirtualSpacer){
		var virtual = list.$virtual;
		var reduce = 0;

		if(index >= list.length - virtual.preparedLength){
			reduce -= prepareCount;
			index = list.length - virtual.preparedLength;
		}

		if(index - virtual.DOMCursor === 0 || index >= list.length) return;

		updating = true;

		// Already on DOM tree
		if((virtual.DOMCursor === 0 && index < prepareCount + prepareCount/2) ||
			(virtual.DOMCursor + prepareCount/2 > index
			&& virtual.DOMCursor + prepareCount < index))
			scroller.scrollTop = parentNode.children[index - virtual.DOMCursor + 1].offsetTop;

		// Move cursor
		else {
			var temp = null;
			var ceiling = virtual.dCursor.ceiling;
			var floor = virtual.dCursor.floor;
			var vCursor = virtual.vCursor;

			// DOM tree to virtual DOM
			var length = parentNode.childElementCount - 2;
			for (var i = 0; i < length; i++) {
				temp = ceiling.nextElementSibling;

				if(vCursor.floor === null){
					virtual.dom.insertAdjacentElement('beforeEnd', temp);

					if(i === length-1)
						vCursor.floor = temp;
				}
				else vCursor.floor.insertAdjacentElement('beforeBegin', temp);
			}

			if(index >= prepareCount){
				if(index < list.length - virtual.preparedLength)
					index -= prepareCount;
			}
			else{
				reduce = prepareCount - index;
				virtual.DOMCursor = index = 0;
			}

			var insertCount = virtual.preparedLength <= list.length ? virtual.preparedLength : list.length;

			// Virtual DOM to DOM tree
			for (var i = 0; i < insertCount; i++) {
				temp = virtual.dom.children[index];
				if(temp === null) break;

				floor.insertAdjacentElement('beforeBegin', temp);
			}
			virtual.DOMCursor = index;

			vCursor.floor = virtual.dom.children[index] || null;
			vCursor.ceiling = vCursor.floor ? vCursor.floor.previousElementSibling : null;

			if(refreshVirtualSpacer)
				refreshVirtualSpacer(index);

			refreshScrollBounding(index, virtual.bounding, list, parentNode);
			scroller.scrollTop = parentNode.children[prepareCount - reduce + 1].offsetTop;
		}

		updating = false;
	}

	function removeUserScrollFocus(parentNode){
		parentNode.style.overflow = 'hidden';
		setTimeout(function(){
			parentNode.style.overflow = '';
		}, 50);
	}
};