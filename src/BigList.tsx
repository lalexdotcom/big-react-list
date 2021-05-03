import classnames from "classnames";
import React from "react";
import ReactList from "react-list";

export type ListColumn<T = any, O = any, V = any> = {
	header?: React.ReactNode | ((options: O, handler: (type: string, payload?: any) => void) => React.ReactNode);

	value?: (o: T) => V;
	content?: (
		o: T,
		options: O | null,
		value: V,
		index: number,
		handler: (type: string, data: T, payload?: any) => void
	) => React.ReactNode;

	sort?: boolean;
	className?: string | ((o: T) => string);
};

export type ListSort<T> = { column: ComputedColumn<T>; desc?: boolean };

type BigListProps<T, O = any> = {
	title?: string;
	className?: string;

	rowClassName?: (data: T) => string | null;

	columns: ListColumn<T, O>[];
	source: T[];
	options?: O;

	value?: T;

	clickable?: boolean;

	onClick?: (item: T) => void;
	onChange?: (sorted: T[], sort?: ListSort<T>) => void;

	handlers?: { [key: string]: ((data: T, payload?: any) => void) | ((payload?: any) => void) };

	file?: string;
};

type ComputedColumn<T = any, O = any, V = any> = { column: ListColumn<T, O, V>; field: string };
type ComputedData<T> = { computed: { [key: string]: any }; source: T };

type BigListState<T, O = any> = {
	header: boolean;
	columns: ComputedColumn<T, O>[];
	source: ComputedData<T>[];
	sorted: ComputedData<T>[];
	sort?: ListSort<T>;
};

const defaultBigListState: BigListState<any, any> = {
	header: false,
	columns: [],
	source: [],
	sorted: [],
};

export class BigList<T = any, O = any> extends React.Component<BigListProps<T, O>, BigListState<T, O>> {
	state = defaultBigListState;

	private renderLine(
		computedData: ComputedData<T>,
		columns: ComputedColumn[],
		index: number,
		key: React.Key,
		selected: boolean,
		clickable?: boolean
	): JSX.Element {
		const { onClick, rowClassName } = this.props;
		const className = rowClassName?.(computedData.source);
		return clickable ? (
			<button
				className={classnames("bl-row", "bl-button", className, { selected })}
				key={`line-${key}`}
				onClick={() => {
					if (onClick) onClick(computedData.source);
				}}
			>
				{this.renderColumns(computedData, columns, index)}
			</button>
		) : (
			<div className={classnames("bl-row", className)} key={`line-${key}`}>
				{this.renderColumns(computedData, columns, index)}
			</div>
		);
	}

	private cellHandler(type: string, data: T, payload?: any) {
		const { handlers } = this.props;
		if (handlers?.[type]) {
			const handler: (data: T, payload?: any) => void = handlers[type];
			handler(data, payload);
		}
	}

	private renderColumns(data: ComputedData<T>, columns: ComputedColumn<T, O>[], index: number): JSX.Element {
		const { options } = this.props;
		return (
			<>
				{columns.map((c, i) => {
					const val = data.computed[c.field];
					return (
						<div
							key={`column-${i}`}
							className={classnames(
								"bl-cell",
								typeof c.column.className === "string"
									? c.column.className
									: c.column.className?.(data.source)
							)}
						>
							{c.column.content
								? c.column.content(
										data.source,
										options || null,
										val,
										index,
										this.cellHandler.bind(this)
								  )
								: val}
						</div>
					);
				})}
			</>
		);
	}

	componentDidMount() {
		// const { source, columns } = this.props;
		// const { sort } = this.state;
		this.computeColumns(this.props.columns);
		// this.sortSource(source, sort);
	}

	shouldComponentUpdate(nextProps: BigListProps<T>, nextState: BigListState<T>) {
		const propSourceChanged = nextProps.source !== this.props.source,
			propColumnsChanged = nextProps.columns !== this.props.columns,
			stateColumnsChanged = nextState.columns !== this.state.columns,
			stateSourceChanged = nextState.source !== this.state.source,
			sortChanged = nextState.sort !== this.state.sort;

		let shouldUpdate = true;

		if (propColumnsChanged) {
			this.computeColumns(nextProps.columns);
			shouldUpdate = false;
		} else if (stateColumnsChanged || propSourceChanged) {
			this.computeSource(nextProps.source, nextState.columns);
			shouldUpdate = false;
		} else if (stateSourceChanged || sortChanged) {
			this.sortSource(nextState.source, stateColumnsChanged ? undefined : nextState.sort);
			shouldUpdate = false;
		}

		return shouldUpdate;
	}

	private computeColumns(columns: ListColumn<T>[]) {
		let header = false;
		const displayColumns = columns.map<ComputedColumn<T>>((col, i) => {
			if (col.header) header = true;
			return { column: col, field: `col-${i}` };
		});
		this.setState({ columns: displayColumns, header, sort: undefined });
	}

	private computeSource(source: T[], columns: ComputedColumn<T>[]) {
		const computedSource: ComputedData<T>[] = [];
		source.forEach(src => {
			const computed: ComputedData<T>["computed"] = {};
			columns.forEach(col => {
				computed[col.field] = col.column.value ? col.column.value(src) : src;
			});
			computedSource.push({ computed, source: src });
		});
		this.setState({ source: computedSource });
	}

	private sortSource(source: ComputedData<T>[], sort: ListSort<T> | undefined) {
		const sorted = [...source];

		if (sort) {
			const { column, desc } = sort;
			sorted.sort((data1, data2) => {
				const val1 = data1.computed[column.field],
					val2 = data2.computed[column.field];
				return (desc ? -1 : 1) * (val1 > val2 ? 1 : val1 < val2 ? -1 : 0);
			});
		}
		this.setState({ sorted });
	}

	componentDidUpdate(prevProps: BigListProps<T>, prevState: BigListState<T>) {
		if (prevState.sorted !== this.state.sorted) {
			this.props.onChange?.(
				this.state.sorted.map(cmp => cmp.source),
				this.state.sort
			);
		}
	}

	private setSort(c: ComputedColumn) {
		const { sort } = this.state;
		this.setState({ sort: sort?.column == c && sort.desc ? undefined : { column: c, desc: sort?.column == c } });
	}

	private headerHandler(type: string, payload?: any) {
		const { handlers } = this.props;
		if (handlers?.[type]) {
			const handler: (payload?: any) => void = handlers[type];
			handler(payload);
		}
	}

	render() {
		const { value, clickable, className, options } = this.props;
		const { sort, sorted, columns, header } = this.state;
		return (
			<div className={`big-list ${className || ""}`}>
				{header ? (
					<div className="bl-header">
						{columns.map((c, i) => (
							<div key={`column-${i}`} className={`bl-cell ${c.column.className || ""}`}>
								{c.column.sort ? (
									<button
										className={classnames("bl-column bl-button", {
											"bl-sorted": sort?.column == c,
											"bl-sorted-desc": !!sort?.desc,
										})}
										onClick={() => this.setSort(c)}
									>
										<span className="bl-button-content">
											{typeof c.column.header == "function"
												? c.column.header(options, this.headerHandler.bind(this))
												: c.column.header}
										</span>
										<span className="bl-sort-icon">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="16"
												height="16"
												viewBox="0 0 24 24"
											>
												<path fill="%23000" d="M7,15L12,10L17,15H7Z" />
											</svg>
										</span>
									</button>
								) : (
									<span className="bl-column">
										{typeof c.column.header == "function"
											? c.column.header(options, this.headerHandler.bind(this))
											: c.column.header}
									</span>
								)}
							</div>
						))}
					</div>
				) : null}
				<div className="bl-list">
					<ReactList
						itemRenderer={(index, key) =>
							this.renderLine(
								sorted[index],
								columns,
								index,
								key,
								sorted[index].source === value,
								clickable
							)
						}
						length={sorted.length}
						type="uniform"
						threshold={200}
					/>
				</div>
			</div>
		);
	}
}
