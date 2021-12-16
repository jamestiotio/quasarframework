import { h, ref, computed, watch, getCurrentInstance } from 'vue'

import { useFormInject, useFormProps, useFormAttrs } from '../../composables/private/use-form.js'

import useSlider, {
  useSliderProps,
  useSliderEmits,
  keyCodes
} from './use-slider.js'

import { createComponent } from '../../utils/private/create.js'
import { between } from '../../utils/format.js'
import { stopAndPrevent } from '../../utils/event.js'
import { hDir } from '../../utils/private/render.js'

export default createComponent({
  name: 'QSlider',

  props: {
    ...useSliderProps,
    ...useFormProps,

    modelValue: {
      required: true,
      default: null,
      validator: v => typeof v === 'number' || v === null
    },

    labelValue: [ String, Number ]
  },

  emits: useSliderEmits,

  setup (props, { emit }) {
    const { proxy: { $q } } = getCurrentInstance()

    const formAttrs = useFormAttrs(props)
    const injectFormInput = useFormInject(formAttrs)

    const { state, methods } = useSlider({
      updateValue, updatePosition, getDragging
    })

    const rootRef = ref(null)
    const curRatio = ref(0)

    const model = ref(props.modelValue === null ? state.innerMin.value : props.modelValue)

    const modelRatio = computed(() => methods.convertModelToRatio(model.value))
    const ratio = computed(() => (state.active.value === true ? curRatio.value : modelRatio.value))

    const trackStyle = computed(() => ({
      [ state.positionProp.value ]: `${ 100 * state.innerMinRatio.value }%`,
      [ state.sizeProp.value ]: `${ 100 * (ratio.value - state.innerMinRatio.value) }%`
    }))

    const thumbStyle = computed(() => ({
      [ state.positionProp.value ]: `${ 100 * ratio.value }%`
    }))

    const thumbClass = computed(() => (
      state.preventFocus.value === false && state.focus.value === true
        ? ' q-slider--focus'
        : ''
    ))

    const pinClass = computed(() => (
      props.labelColor !== void 0
        ? ` text-${ props.labelColor }`
        : ''
    ))

    const pinTextClass = computed(() =>
      'q-slider__pin-value-marker-text'
      + (props.labelTextColor !== void 0 ? ` text-${ props.labelTextColor }` : '')
    )

    const events = computed(() => {
      if (state.editable.value !== true) {
        return {}
      }

      return $q.platform.is.mobile === true
        ? { onClick: methods.onMobileClick }
        : {
            onMousedown: methods.onActivate,
            onFocus,
            onBlur: methods.onBlur,
            onKeydown,
            onKeyup: methods.onKeyup
          }
    })

    const label = computed(() => (
      props.labelValue !== void 0
        ? props.labelValue
        : model.value
    ))

    const pinStyle = computed(() => {
      const percent = (props.reverse === true ? -ratio.value : ratio.value - 1)
      return methods.getPinStyle(percent, ratio.value)
    })

    watch(() => props.modelValue + state.innerMin.value + state.innerMax.value, () => {
      model.value = props.modelValue === null
        ? state.innerMin.value
        : between(props.modelValue, state.innerMin.value, state.innerMax.value)
    })

    function updateValue (change) {
      if (model.value !== props.modelValue) {
        emit('update:modelValue', model.value)
      }
      change === true && emit('change', model.value)
    }

    function getDragging () {
      return rootRef.value.getBoundingClientRect()
    }

    function updatePosition (event, dragging = state.dragging.value) {
      const ratio = methods.getDraggingRatio(event, dragging)

      model.value = methods.convertRatioToModel(ratio)

      curRatio.value = props.snap !== true || props.step === 0
        ? ratio
        : methods.convertModelToRatio(model.value)
    }

    function onFocus () {
      state.focus.value = true
    }

    function onKeydown (evt) {
      if (!keyCodes.includes(evt.keyCode)) {
        return
      }

      stopAndPrevent(evt)

      const
        stepVal = ([ 34, 33 ].includes(evt.keyCode) ? 10 : 1) * state.step.value,
        offset = [ 34, 37, 40 ].includes(evt.keyCode) ? -stepVal : stepVal

      model.value = between(
        parseFloat((model.value + offset).toFixed(state.decimals.value)),
        state.innerMin.value,
        state.innerMax.value
      )

      updateValue()
    }

    return () => {
      const track = [
        h('div', {
          class: `q-slider__inner-track q-slider__inner-track${ state.axis.value } absolute`,
          style: state.innerTrackStyle.value
        }),

        h('div', {
          class: `q-slider__track q-slider__track${ state.axis.value } absolute`,
          style: trackStyle.value
        })
      ]

      props.markers !== false && track.push(
        h('div', {
          class: `q-slider__track-markers q-slider__track-markers${ state.axis.value } absolute inherit-border-radius overflow-hidden`,
          style: state.markerStyle.value
        })
      )

      props.markerLabels !== false && track.push(methods.getMarkerLabels())

      const thumb = [
        methods.getThumbSvg(),
        h('div', { class: 'q-slider__focus-ring' })
      ]

      if (props.label === true || props.labelAlways === true) {
        thumb.push(
          h('div', {
            class: state.pinClass.value + pinClass.value,
            style: pinStyle.value.pin
          }, [
            h('div', {
              class: state.pinTextClass.value,
              style: pinStyle.value.pinTextContainer
            }, [
              h('span', {
                class: 'q-slider__pin-text ' + pinTextClass.value
              }, [
                label.value
              ])
            ])
          ]),

          h('div', {
            class: state.arrowClass.value + pinClass.value
          })
        )
      }

      if (props.name !== void 0 && props.disable !== true) {
        injectFormInput(thumb, 'push')
      }

      const content = [
        h('div', {
          class: `q-slider__track-container q-slider__track-container${ state.axis.value } absolute`
        }, track),

        h('div', {
          class: `q-slider__thumb-container q-slider__thumb-container${ state.axis.value } absolute non-selectable`
            + thumbClass.value,
          style: thumbStyle.value
        }, thumb)
      ]

      const data = {
        ref: rootRef,
        class: state.classes.value + (props.modelValue === null ? ' q-slider--no-value' : ''),
        ...state.attributes.value,
        'aria-valuenow': props.modelValue,
        tabindex: state.tabindex.value,
        ...events.value
      }

      return hDir('div', data, content, 'slide', state.editable.value, () => state.panDirective.value)
    }
  }
})
