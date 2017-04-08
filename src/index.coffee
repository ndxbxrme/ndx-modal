'use strict'
module = null
try
  module = angular.module 'ndx'
catch e
  module = angular.module 'ndx-modal', []
module.factory '$transition', ($q, $timeout, $rootScope) ->
  $transition = (element, trigger, options) ->
    options = options or {}
    deferred = $q.defer()
    endEventName = $transition[if options.animation then 'animationEndEventName' else 'transitionEndEventName']

    transitionEndHandler = (event) ->
      $rootScope.$apply ->
        element.unbind endEventName, transitionEndHandler
        deferred.resolve element
        return
      return

    if endEventName
      element.bind endEventName, transitionEndHandler
    # Wrap in a timeout to allow the browser time to update the DOM before the transition is to occur
    $timeout ->
      if angular.isString(trigger)
        element.addClass trigger
      else if angular.isFunction(trigger)
        trigger element
      else if angular.isObject(trigger)
        element.css trigger
      #If browser does not support transitions, instantly resolve
      if !endEventName
        deferred.resolve element
      return
    # Add our custom cancel function to the promise that is returned
    # We can call this if we are about to run a new transition, which we know will prevent this transition from ending,
    # i.e. it will therefore never raise a transitionEnd event for that transition

    deferred.promise.cancel = ->
      if endEventName
        element.unbind endEventName, transitionEndHandler
      deferred.reject 'Transition cancelled'
      return

    deferred.promise

  # Work out the name of the transitionEnd event
  transElement = document.createElement('trans')
  transitionEndEventNames = 
    'WebkitTransition': 'webkitTransitionEnd'
    'MozTransition': 'transitionend'
    'OTransition': 'oTransitionEnd'
    'transition': 'transitionend'
  animationEndEventNames = 
    'WebkitTransition': 'webkitAnimationEnd'
    'MozTransition': 'animationend'
    'OTransition': 'oAnimationEnd'
    'transition': 'animationend'

  findEndEventName = (endEventNames) ->
    for name of endEventNames
      if transElement.style[name] != undefined
        return endEventNames[name]
    return

  $transition.transitionEndEventName = findEndEventName(transitionEndEventNames)
  $transition.animationEndEventName = findEndEventName(animationEndEventNames)
  $transition
.factory('$$stackedMap', ->
  { createNew: ->
    stack = []
    {
      add: (key, value) ->
        stack.push
          key: key
          value: value
        return
      get: (key) ->
        i = 0
        while i < stack.length
          if key == stack[i].key
            return stack[i]
          i++
        return
      keys: ->
        keys = []
        i = 0
        while i < stack.length
          keys.push stack[i].key
          i++
        keys
      top: ->
        stack[stack.length - 1]
      remove: (key) ->
        idx = -1
        i = 0
        while i < stack.length
          if key == stack[i].key
            idx = i
            break
          i++
        stack.splice(idx, 1)[0]
      removeTop: ->
        stack.splice(stack.length - 1, 1)[0]
      length: ->
        stack.length

    }
 }
).directive('modalBackdrop', ($modalStack, $timeout) ->
  {
    restrict: 'EA'
    replace: true
    templateUrl: 'template/modal/backdrop.html'
    link: (scope) ->
      scope.animate = false
      #trigger CSS transitions
      $timeout ->
        scope.animate = true
        return

      scope.close = (evt) ->
        modal = $modalStack.getTop()
        if modal and modal.value.backdrop and modal.value.backdrop != 'static' and evt.target == evt.currentTarget
          evt.preventDefault()
          evt.stopPropagation()
          $modalStack.dismiss modal.key, 'backdrop click'
        return

      return

  }
).directive('modalWindow', ($modalStack, $timeout) ->
  {
    restrict: 'EA'
    scope:
      index: '@'
      animate: '='
    replace: true
    transclude: true
    templateUrl: 'template/modal/window.html'
    link: (scope, element, attrs) ->
      scope.windowClass = attrs.windowClass or ''
      $timeout ->
        # trigger CSS transitions
        scope.animate = true
        # If the modal contains any autofocus elements refocus onto the first one
        if element[0].querySelectorAll('[autofocus]').length > 0
          element[0].querySelectorAll('[autofocus]')[0].focus()
        else
          # otherwise focus the freshly-opened modal
          element[0].focus()
        return
      return

  }
).factory('$modalStack', ($transition, $timeout, $document, $compile, $rootScope, $$stackedMap) ->
  OPENED_MODAL_CLASS = 'modal-open'
  backdropDomEl = undefined
  backdropScope = undefined
  openedWindows = $$stackedMap.createNew()
  $modalStack = {}

  backdropIndex = ->
    topBackdropIndex = -1
    opened = openedWindows.keys()
    i = 0
    while i < opened.length
      if openedWindows.get(opened[i]).value.backdrop
        topBackdropIndex = i
      i++
    topBackdropIndex

  removeModalWindow = (modalInstance) ->
    body = $document.find('body').eq(0)
    modalWindow = openedWindows.get(modalInstance).value
    #clean up the stack
    openedWindows.remove modalInstance
    #remove window DOM element
    removeAfterAnimate modalWindow.modalDomEl, modalWindow.modalScope, 300, checkRemoveBackdrop
    body.toggleClass OPENED_MODAL_CLASS, openedWindows.length() > 0
    return

  checkRemoveBackdrop = ->
    #remove backdrop if no longer needed
    if backdropDomEl and backdropIndex() == -1
      backdropScopeRef = backdropScope
      removeAfterAnimate backdropDomEl, backdropScope, 150, ->
        backdropScopeRef.$destroy()
        backdropScopeRef = null
        return
      backdropDomEl = undefined
      backdropScope = undefined
    return

  removeAfterAnimate = (domEl, scope, emulateTime, done) ->
    # Closing animation

    afterAnimating = ->
      if afterAnimating.done
        return
      afterAnimating.done = true
      domEl.remove()
      if done
        done()
      return

    scope.animate = false
    transitionEndEventName = $transition.transitionEndEventName
    if transitionEndEventName
      # transition out
      timeout = $timeout(afterAnimating, emulateTime)
      domEl.bind transitionEndEventName, ->
        $timeout.cancel timeout
        afterAnimating()
        scope.$apply()
        return
    else
      # Ensure this call is async
      $timeout afterAnimating, 0
    return

  $rootScope.$watch backdropIndex, (newBackdropIndex) ->
    if backdropScope
      backdropScope.index = newBackdropIndex
    return
  $document.bind 'keydown', (evt) ->
    modal = undefined
    if evt.which == 27
      modal = openedWindows.top()
      if modal and modal.value.keyboard
        $rootScope.$apply ->
          $modalStack.dismiss modal.key
          return
    return

  $modalStack.open = (modalInstance, modal) ->
    openedWindows.add modalInstance,
      deferred: modal.deferred
      modalScope: modal.scope
      backdrop: modal.backdrop
      keyboard: modal.keyboard
    body = $document.find('body').eq(0)
    currBackdropIndex = backdropIndex()
    if currBackdropIndex >= 0 and !backdropDomEl
      backdropScope = $rootScope.$new(true)
      backdropScope.index = currBackdropIndex
      backdropDomEl = $compile('<div modal-backdrop></div>')(backdropScope)
      body.append backdropDomEl
    angularDomEl = angular.element('<div modal-window></div>')
    angularDomEl.attr 'window-class', modal.windowClass
    angularDomEl.attr 'index', openedWindows.length() - 1
    angularDomEl.attr 'animate', 'animate'
    angularDomEl.html modal.content
    modalDomEl = $compile(angularDomEl)(modal.scope)
    openedWindows.top().value.modalDomEl = modalDomEl
    body.append modalDomEl
    body.addClass OPENED_MODAL_CLASS
    return

  $modalStack.close = (modalInstance, result) ->
    modalWindow = openedWindows.get(modalInstance).value
    if modalWindow
      modalWindow.deferred.resolve result
      removeModalWindow modalInstance
    return

  $modalStack.dismiss = (modalInstance, reason) ->
    modalWindow = openedWindows.get(modalInstance).value
    if modalWindow
      modalWindow.deferred.reject reason
      removeModalWindow modalInstance
    return

  $modalStack.dismissAll = (reason) ->
    topModal = @getTop()
    while topModal
      @dismiss topModal.key, reason
      topModal = @getTop()
    return

  $modalStack.getTop = ->
    openedWindows.top()

  $modalStack
).provider 'ndxModal', ->
  $modalProvider = 
    options:
      backdrop: true
      keyboard: true
    $get: ($injector, $rootScope, $q, $http, $templateCache, $controller, $modalStack) ->
      $modal = {}

      getTemplatePromise = (options) ->
        if options.template then $q.when(options.template) else $http.get(options.templateUrl, cache: $templateCache).then(((result) ->
          result.data
        ))

      getResolvePromises = (resolves) ->
        promisesArr = []
        angular.forEach resolves, (value, key) ->
          if angular.isFunction(value) or angular.isArray(value)
            promisesArr.push $q.when($injector.invoke(value))
          return
        promisesArr

      $modal.open = (modalOptions) ->
        modalResultDeferred = $q.defer()
        modalOpenedDeferred = $q.defer()
        #prepare an instance of a modal to be injected into controllers and returned to a caller
        modalInstance = 
          result: modalResultDeferred.promise
          opened: modalOpenedDeferred.promise
          close: (result) ->
            $modalStack.close modalInstance, result
            return
          dismiss: (reason) ->
            $modalStack.dismiss modalInstance, reason
            return
        #merge and clean up options
        modalOptions = angular.extend({}, $modalProvider.options, modalOptions)
        modalOptions.resolve = modalOptions.resolve or {}
        #verify options
        if !modalOptions.template and !modalOptions.templateUrl
          throw new Error('One of template or templateUrl options is required.')
        templateAndResolvePromise = $q.all([ getTemplatePromise(modalOptions) ].concat(getResolvePromises(modalOptions.resolve)))
        templateAndResolvePromise.then ((tplAndVars) ->
          modalScope = (modalOptions.scope or $rootScope).$new()
          modalScope.$close = modalInstance.close
          modalScope.$dismiss = modalInstance.dismiss
          ctrlInstance = undefined
          ctrlLocals = {}
          resolveIter = 1
          #controllers
          if modalOptions.controller
            ctrlLocals.$scope = modalScope
            ctrlLocals.ndxModalInstance = modalInstance
            angular.forEach modalOptions.resolve, (value, key) ->
              ctrlLocals[key] = tplAndVars[resolveIter++]
              return
            ctrlInstance = $controller(modalOptions.controller, ctrlLocals)
          $modalStack.open modalInstance,
            scope: modalScope
            deferred: modalResultDeferred
            content: tplAndVars[0]
            backdrop: modalOptions.backdrop
            keyboard: modalOptions.keyboard
            windowClass: modalOptions.windowClass
          return
        ), (reason) ->
          modalResultDeferred.reject reason
          return
        templateAndResolvePromise.then (->
          modalOpenedDeferred.resolve true
          return
        ), ->
          modalOpenedDeferred.reject false
          return
        modalInstance

      $modal
  $modalProvider
.run ($templateCache) ->
  console.log 'putting'
  $templateCache.put 'template/modal/backdrop.html', '<div class="reveal-modal-bg fade" ng-class="{in: animate}" ng-click="close($event)" style="display: block"></div>\n' + ''
  return

.run ($templateCache) ->
  $templateCache.put 'template/modal/window.html', '<div tabindex="-1" class="reveal-modal fade {{ windowClass }}"\n' + '  ng-class="{in: animate}" ng-click="close($event)"\n' + '  style="display: block; position: fixed; visibility: visible">\n' + '  <div ng-transclude></div>\n' + '</div>\n' + ''
  return
# ---
# generated by js2coffee 2.2.0