import {
	type Component,
	asEnum,
	component,
	setText,
	toggleClass,
} from '@zeix/ui-element'

export type BasicStatusProps = {
	status: string
}

export const basicStatusOptions: [string, ...string[]] = [
	'success',
	'warning',
	'error',
]

export default component(
	'basic-status',
	{
		status: asEnum(basicStatusOptions),
	},
	el => [
		setText('status'),
		...basicStatusOptions.map(status =>
			toggleClass<BasicStatusProps, Component<BasicStatusProps>>(
				status,
				() => el.status === status
			)
		),
	]
)

declare global {
	interface HTMLElementTagNameMap {
		'basic-status': Component<BasicStatusProps>
	}
}
