(function() {
  'use strict';
  var e, error, module;

  module = null;

  try {
    module = angular.module('ndx');
  } catch (error) {
    e = error;
    module = angular.module('ndx-modal', []);
  }

  module.factory('$transition', function($q, $timeout, $rootScope) {
    var $transition, animationEndEventNames, findEndEventName, transElement, transitionEndEventNames;
    $transition = function(element, trigger, options) {
      var deferred, endEventName, transitionEndHandler;
      options = options || {};
      deferred = $q.defer();
      endEventName = $transition[options.animation ? 'animationEndEventName' : 'transitionEndEventName'];
      transitionEndHandler = function(event) {
        $rootScope.$apply(function() {
          element.unbind(endEventName, transitionEndHandler);
          deferred.resolve(element);
        });
      };
      if (endEventName) {
        element.bind(endEventName, transitionEndHandler);
      }
      $timeout(function() {
        if (angular.isString(trigger)) {
          element.addClass(trigger);
        } else if (angular.isFunction(trigger)) {
          trigger(element);
        } else if (angular.isObject(trigger)) {
          element.css(trigger);
        }
        if (!endEventName) {
          deferred.resolve(element);
        }
      });
      deferred.promise.cancel = function() {
        if (endEventName) {
          element.unbind(endEventName, transitionEndHandler);
        }
        deferred.reject('Transition cancelled');
      };
      return deferred.promise;
    };
    transElement = document.createElement('trans');
    transitionEndEventNames = {
      'WebkitTransition': 'webkitTransitionEnd',
      'MozTransition': 'transitionend',
      'OTransition': 'oTransitionEnd',
      'transition': 'transitionend'
    };
    animationEndEventNames = {
      'WebkitTransition': 'webkitAnimationEnd',
      'MozTransition': 'animationend',
      'OTransition': 'oAnimationEnd',
      'transition': 'animationend'
    };
    findEndEventName = function(endEventNames) {
      var name;
      for (name in endEventNames) {
        if (transElement.style[name] !== void 0) {
          return endEventNames[name];
        }
      }
    };
    $transition.transitionEndEventName = findEndEventName(transitionEndEventNames);
    $transition.animationEndEventName = findEndEventName(animationEndEventNames);
    return $transition;
  }).factory('$$stackedMap', function() {
    return {
      createNew: function() {
        var stack;
        stack = [];
        return {
          add: function(key, value) {
            stack.push({
              key: key,
              value: value
            });
          },
          get: function(key) {
            var i;
            i = 0;
            while (i < stack.length) {
              if (key === stack[i].key) {
                return stack[i];
              }
              i++;
            }
          },
          keys: function() {
            var i, keys;
            keys = [];
            i = 0;
            while (i < stack.length) {
              keys.push(stack[i].key);
              i++;
            }
            return keys;
          },
          top: function() {
            return stack[stack.length - 1];
          },
          remove: function(key) {
            var i, idx;
            idx = -1;
            i = 0;
            while (i < stack.length) {
              if (key === stack[i].key) {
                idx = i;
                break;
              }
              i++;
            }
            return stack.splice(idx, 1)[0];
          },
          removeTop: function() {
            return stack.splice(stack.length - 1, 1)[0];
          },
          length: function() {
            return stack.length;
          }
        };
      }
    };
  }).directive('modalBackdrop', function($modalStack, $timeout) {
    return {
      restrict: 'EA',
      replace: true,
      templateUrl: 'template/modal/backdrop.html',
      link: function(scope) {
        scope.animate = false;
        $timeout(function() {
          scope.animate = true;
        });
        scope.close = function(evt) {
          var modal;
          modal = $modalStack.getTop();
          if (modal && modal.value.backdrop && modal.value.backdrop !== 'static' && evt.target === evt.currentTarget) {
            evt.preventDefault();
            evt.stopPropagation();
            $modalStack.dismiss(modal.key, 'backdrop click');
          }
        };
      }
    };
  }).directive('modalWindow', function($modalStack, $timeout) {
    return {
      restrict: 'EA',
      scope: {
        index: '@',
        animate: '='
      },
      replace: true,
      transclude: true,
      templateUrl: 'template/modal/window.html',
      link: function(scope, element, attrs) {
        scope.windowClass = attrs.windowClass || '';
        $timeout(function() {
          scope.animate = true;
          if (element[0].querySelectorAll('[autofocus]').length > 0) {
            element[0].querySelectorAll('[autofocus]')[0].focus();
          } else {
            element[0].focus();
          }
        });
      }
    };
  }).factory('$modalStack', function($transition, $timeout, $document, $compile, $rootScope, $$stackedMap) {
    var $modalStack, OPENED_MODAL_CLASS, backdropDomEl, backdropIndex, backdropScope, checkRemoveBackdrop, openedWindows, removeAfterAnimate, removeModalWindow;
    OPENED_MODAL_CLASS = 'modal-open';
    backdropDomEl = void 0;
    backdropScope = void 0;
    openedWindows = $$stackedMap.createNew();
    $modalStack = {};
    backdropIndex = function() {
      var i, opened, topBackdropIndex;
      topBackdropIndex = -1;
      opened = openedWindows.keys();
      i = 0;
      while (i < opened.length) {
        if (openedWindows.get(opened[i]).value.backdrop) {
          topBackdropIndex = i;
        }
        i++;
      }
      return topBackdropIndex;
    };
    removeModalWindow = function(modalInstance) {
      var body, modalWindow;
      body = $document.find('body').eq(0);
      modalWindow = openedWindows.get(modalInstance).value;
      openedWindows.remove(modalInstance);
      removeAfterAnimate(modalWindow.modalDomEl, modalWindow.modalScope, 300, checkRemoveBackdrop);
      body.toggleClass(OPENED_MODAL_CLASS, openedWindows.length() > 0);
    };
    checkRemoveBackdrop = function() {
      var backdropScopeRef;
      if (backdropDomEl && backdropIndex() === -1) {
        backdropScopeRef = backdropScope;
        removeAfterAnimate(backdropDomEl, backdropScope, 150, function() {
          backdropScopeRef.$destroy();
          backdropScopeRef = null;
        });
        backdropDomEl = void 0;
        backdropScope = void 0;
      }
    };
    removeAfterAnimate = function(domEl, scope, emulateTime, done) {
      var afterAnimating, timeout, transitionEndEventName;
      afterAnimating = function() {
        if (afterAnimating.done) {
          return;
        }
        afterAnimating.done = true;
        domEl.remove();
        if (done) {
          done();
        }
      };
      scope.animate = false;
      transitionEndEventName = $transition.transitionEndEventName;
      if (transitionEndEventName) {
        timeout = $timeout(afterAnimating, emulateTime);
        domEl.bind(transitionEndEventName, function() {
          $timeout.cancel(timeout);
          afterAnimating();
          scope.$apply();
        });
      } else {
        $timeout(afterAnimating, 0);
      }
    };
    $rootScope.$watch(backdropIndex, function(newBackdropIndex) {
      if (backdropScope) {
        backdropScope.index = newBackdropIndex;
      }
    });
    $document.bind('keydown', function(evt) {
      var modal;
      modal = void 0;
      if (evt.which === 27) {
        modal = openedWindows.top();
        if (modal && modal.value.keyboard) {
          $rootScope.$apply(function() {
            $modalStack.dismiss(modal.key);
          });
        }
      }
    });
    $modalStack.open = function(modalInstance, modal) {
      var angularDomEl, body, currBackdropIndex, modalDomEl;
      openedWindows.add(modalInstance, {
        deferred: modal.deferred,
        modalScope: modal.scope,
        backdrop: modal.backdrop,
        keyboard: modal.keyboard
      });
      body = $document.find('body').eq(0);
      currBackdropIndex = backdropIndex();
      if (currBackdropIndex >= 0 && !backdropDomEl) {
        backdropScope = $rootScope.$new(true);
        backdropScope.index = currBackdropIndex;
        backdropDomEl = $compile('<div modal-backdrop></div>')(backdropScope);
        body.append(backdropDomEl);
      }
      angularDomEl = angular.element('<div modal-window></div>');
      angularDomEl.attr('window-class', modal.windowClass);
      angularDomEl.attr('index', openedWindows.length() - 1);
      angularDomEl.attr('animate', 'animate');
      angularDomEl.html(modal.content);
      modalDomEl = $compile(angularDomEl)(modal.scope);
      openedWindows.top().value.modalDomEl = modalDomEl;
      body.append(modalDomEl);
      body.addClass(OPENED_MODAL_CLASS);
    };
    $modalStack.close = function(modalInstance, result) {
      var modalWindow;
      modalWindow = openedWindows.get(modalInstance).value;
      if (modalWindow) {
        modalWindow.deferred.resolve(result);
        removeModalWindow(modalInstance);
      }
    };
    $modalStack.dismiss = function(modalInstance, reason) {
      var modalWindow;
      modalWindow = openedWindows.get(modalInstance).value;
      if (modalWindow) {
        modalWindow.deferred.reject(reason);
        removeModalWindow(modalInstance);
      }
    };
    $modalStack.dismissAll = function(reason) {
      var topModal;
      topModal = this.getTop();
      while (topModal) {
        this.dismiss(topModal.key, reason);
        topModal = this.getTop();
      }
    };
    $modalStack.getTop = function() {
      return openedWindows.top();
    };
    return $modalStack;
  }).provider('ndxModal', function() {
    var $modalProvider;
    $modalProvider = {
      options: {
        backdrop: true,
        keyboard: true
      },
      $get: function($injector, $rootScope, $q, $http, $templateCache, $controller, $modalStack) {
        var $modal, getResolvePromises, getTemplatePromise;
        $modal = {};
        getTemplatePromise = function(options) {
          if (options.template) {
            return $q.when(options.template);
          } else {
            return $http.get(options.templateUrl, {
              cache: $templateCache
            }).then((function(result) {
              return result.data;
            }));
          }
        };
        getResolvePromises = function(resolves) {
          var promisesArr;
          promisesArr = [];
          angular.forEach(resolves, function(value, key) {
            if (angular.isFunction(value) || angular.isArray(value)) {
              promisesArr.push($q.when($injector.invoke(value)));
            }
          });
          return promisesArr;
        };
        $modal.open = function(modalOptions) {
          var modalInstance, modalOpenedDeferred, modalResultDeferred, templateAndResolvePromise;
          modalResultDeferred = $q.defer();
          modalOpenedDeferred = $q.defer();
          modalInstance = {
            result: modalResultDeferred.promise,
            opened: modalOpenedDeferred.promise,
            close: function(result) {
              $modalStack.close(modalInstance, result);
            },
            dismiss: function(reason) {
              $modalStack.dismiss(modalInstance, reason);
            }
          };
          modalOptions = angular.extend({}, $modalProvider.options, modalOptions);
          modalOptions.resolve = modalOptions.resolve || {};
          if (!modalOptions.template && !modalOptions.templateUrl) {
            throw new Error('One of template or templateUrl options is required.');
          }
          templateAndResolvePromise = $q.all([getTemplatePromise(modalOptions)].concat(getResolvePromises(modalOptions.resolve)));
          templateAndResolvePromise.then((function(tplAndVars) {
            var ctrlInstance, ctrlLocals, modalScope, resolveIter;
            modalScope = (modalOptions.scope || $rootScope).$new();
            modalScope.$close = modalInstance.close;
            modalScope.$dismiss = modalInstance.dismiss;
            ctrlInstance = void 0;
            ctrlLocals = {};
            resolveIter = 1;
            if (modalOptions.controller) {
              ctrlLocals.$scope = modalScope;
              ctrlLocals.ndxModalInstance = modalInstance;
              angular.forEach(modalOptions.resolve, function(value, key) {
                ctrlLocals[key] = tplAndVars[resolveIter++];
              });
              ctrlInstance = $controller(modalOptions.controller, ctrlLocals);
            }
            $modalStack.open(modalInstance, {
              scope: modalScope,
              deferred: modalResultDeferred,
              content: tplAndVars[0],
              backdrop: modalOptions.backdrop,
              keyboard: modalOptions.keyboard,
              windowClass: modalOptions.windowClass
            });
          }), function(reason) {
            modalResultDeferred.reject(reason);
          });
          templateAndResolvePromise.then((function() {
            modalOpenedDeferred.resolve(true);
          }), function() {
            modalOpenedDeferred.reject(false);
          });
          return modalInstance;
        };
        return $modal;
      }
    };
    return $modalProvider;
  }).run(function($templateCache) {
    $templateCache.put('template/modal/backdrop.html', '<div class="reveal-modal-bg fade" ng-class="{in: animate}" ng-click="close($event)" style="display: block"></div>\n' + '');
  }).run(function($templateCache) {
    $templateCache.put('template/modal/window.html', '<div tabindex="-1" class="reveal-modal fade {{ windowClass }}"\n' + '  ng-class="{in: animate}" ng-click="close($event)"\n' + '  style="display: block; position: fixed; visibility: visible">\n' + '  <div ng-transclude></div>\n' + '</div>\n' + '');
  }).run(function($rootScope, ndxModal) {
    var root;
    root = Object.getPrototypeOf($rootScope);
    return root.modal = function(args) {
      var backdrop, controller, modalInstance, size;
      size = args.size || 'large';
      controller = args.controller || 'YesNoCancelCtrl';
      backdrop = args.backdrop || 'static';
      modalInstance = ndxModal.open({
        templateUrl: "modals/" + args.template + "/" + args.template + ".html",
        windowClass: size,
        controller: controller,
        backdrop: backdrop,
        resolve: {
          data: function() {
            return args.data;
          }
        }
      });
      return modalInstance.result;
    };
  });

}).call(this);

//# sourceMappingURL=index.js.map
