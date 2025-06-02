import {
	type Component,
	asBoolean,
	component,
	first,
	setProperty,
} from '@zeix/ui-element'

export type BasicButtonProps = {
	disabled: boolean
}

export default component(
	'basic-button',
	{
		disabled: asBoolean,
	},
	() => [
		first<BasicButtonProps, HTMLButtonElement>(
			'button',
			setProperty('disabled')
		),
	]
)

declare global {
	interface HTMLElementTagNameMap {
		'basic-button': Component<BasicButtonProps>
	}
}
