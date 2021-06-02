import classnames from "classnames";
import React from "react";
import ReactList from "react-list";

import { LG } from 'big-l';
import { sort as fastSort } from 'fast-sort';
const LGR = LG.ns("BigList");

LGR.time = true;

export type ListColumn<T = any, O = any> = {
	header?: React.ReactNode | ((options: O | null, handler: (type: string, payload?: any) => void) => React.ReactNode);
	className?: string | ((o: T) => string);

	value?: keyof T | ((o: T) => any);
	content?: (
		o: T,
		value: any,
		options: O | null,
		index: number,
		handler: (type: string, data: T, payload?: any) => void
	) => React.ReactNode;
	sortable?: boolean;

};

export type ListSort<T> = { column: ListColumn<T>; desc?: boolean };

type BigListProps<T, O> = {
	title?: string;
	className?: string;

	rowClassName?: (data: T) => string | null;

	columns: ListColumn<T, O>[];
	source: T[];
	options?: O;

	value?: T | null;

	clickable?: boolean;

	onClick?: (item: T) => void;
	onChange?: (displayed: T[], sort?: ListSort<T>) => void;

	handlers?: { [key: string]: ((data: T, payload?: any) => void) | ((payload?: any) => void) };

	file?: string;
};

// type ComputedColumn<T = any, O = any, V = any> = { column: ListColumn<T, O, V>; field: string };
// type ComputedData<T> = { computed: { [key: string]: any }; source: T };

type BigListState<T, O = any> = {
	header: boolean;
	// columns: ComputedColumn<T, O>[];
	// source: ComputedData<T>[];
	// displayed: ComputedData<T>[];
	sorted: T[];
	sort?: ListSort<T>;
};

const defaultBigListState: BigListState<any, any> = {
	header: false,
	// columns: [],
	// source: [],
	// displayed: [],
	sorted: [],
};

const memoized = new Map<Function, Map<any, any>>();

function memo<T, R>(fct: (o: T) => R): (o: T) => R {
	return (o: T) => {
		let funcMemo = memoized.get(fct);
		if (!funcMemo) memoized.set(fct, funcMemo = new Map([[o, fct(o)]]));
		let memoResult = funcMemo.get(o);
		if (memoResult === undefined) funcMemo.set(o, memoResult = fct(o));
		return memoResult;
	}
}

function getColumnValue<T>(d: T, c: ListColumn<T>): any {
	return typeof c.value === "function" ? c.value(d) : c.value ? d[c.value] : d;
}

export class BigList<T = any, O extends object = {}> extends React.Component<BigListProps<T, O>, BigListState<T, O>> {
	state = defaultBigListState;

	private renderLine(
		data: T,
		columns: ListColumn<T>[],
		index: number,
		key: React.Key,
		selected: boolean,
		clickable?: boolean
	): JSX.Element {
		const { onClick, rowClassName } = this.props;
		const className = rowClassName?.(data);
		return clickable ? (
			<button
				className={classnames("bl-row", "bl-button", className, { selected })}
				key={`line-${key}`}
				onClick={() => {
					if (onClick) onClick(data);
				}}
			>
				{this.renderColumns(data, columns, index)}
			</button>
		) : (
			<div className={classnames("bl-row", className)} key={`line-${key}`}>
				{this.renderColumns(data, columns, index)}
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

	private renderColumns(data: T, columns: ListColumn<T, O>[], index: number): JSX.Element {
		const { options } = this.props;
		return (
			<>
				{columns.map((c, i) => {
					const val = getColumnValue(data, c);
					return (
						<div
							key={`column-${i}`}
							className={classnames(
								"bl-cell",
								typeof c.className === "string"
									? c.className
									: c.className?.(data)
							)}
						>
							{c.content
								? c.content(
									data,
									val,
									options || null,
									index,
									this.cellHandler.bind(this)
								)
								: `${val}`}
						</div>
					);
				})}
			</>
		);
	}

	componentDidMount() {
		this.computeHeaders(this.props.columns);
		this.computeData(this.props.source, this.state.sort);
		// this.computeColumns(this.props.columns).then(columns => this.computeSource(this.props.source, columns));
	}

	computeHeaders(columns: ListColumn[]) {
		for (const col of columns) {
			if (col.header) {
				this.setState({ header: true });
				return;
			}
		}
		this.setState({ header: false });
	}

	computeData(source: T[], sort?: ListSort<T>) {
		LGR.debug("Compute", source.length, "datas");
		let sorted = [...source];
		if (sort) {
			if (fastSort) {
				LGR.debug("Use fast-sort", fastSort);
				sorted = sort.desc ? fastSort(source).desc(o => getColumnValue(o, sort.column)) : fastSort(source).asc(o => getColumnValue(o, sort.column))
				LGR.debug("Sort done");
			} else {
				LGR.debug("Use array.sort");
				sorted.sort((a, b) => (sort.desc ? -1 : 1) * (getColumnValue(a, sort.column) > getColumnValue(b, sort.column) ? 1 : -1))
				LGR.debug("Sort done");
			}
		}
		this.setState({ sorted });
	}

	shouldComponentUpdate(nextProps: BigListProps<T, O>, nextState: BigListState<T>) {
		const propSourceChanged = nextProps.source !== this.props.source,
			propColumnsChanged = nextProps.columns !== this.props.columns,
			sortChanged = nextState.sort !== this.state.sort;
		let shouldUpdate = true;
		if (propColumnsChanged) {
			this.computeHeaders(nextProps.columns);
			shouldUpdate = false;
		}
		if (propSourceChanged || sortChanged) {
			this.computeData(nextProps.source, nextState.sort);
			shouldUpdate = false;
		}

		return shouldUpdate;
	}

	// private async computeColumns(columns: ListColumn<T>[]) {
	// 	await new Promise(res => setInterval(res, 1));
	// 	let header = false;
	// 	const displayColumns = columns.map<ComputedColumn<T>>((col, i) => {
	// 		if (!header && col.header) header = true;
	// 		return { column: col, field: `col-${i}` };
	// 	});
	// 	this.setState({ columns: displayColumns, header, sort: undefined });
	// 	return displayColumns;
	// }

	// private async computeSource(source: T[], columns: ComputedColumn<T>[]) {
	// 	await new Promise(res => setInterval(res, 1));
	// 	const computedSource: ComputedData<T>[] = [];
	// 	source.forEach(src => {
	// 		const computed: ComputedData<T>["computed"] = {};
	// 		columns.forEach(col => {
	// 			computed[col.field] = col.column.value ? col.column.value(src) : src;
	// 		});
	// 		computedSource.push({ computed, source: src });
	// 	});
	// 	this.setState({ source: computedSource });
	// }

	// private async displaySource(source: ComputedData<T>[], sort: ListSort<T> | undefined) {
	// 	await new Promise(res => setInterval(res, 1));
	// 	const displayed = [...source];

	// 	if (sort) {
	// 		const { column, desc } = sort;
	// 		displayed.sort((data1, data2) => {
	// 			const val1 = data1.computed[column.field],
	// 				val2 = data2.computed[column.field];
	// 			return (desc ? -1 : 1) * (val1 > val2 ? 1 : val1 < val2 ? -1 : 0);
	// 		});
	// 	}
	// 	this.setState({ displayed });
	// }

	componentDidUpdate(prevProps: BigListProps<T, O>, prevState: BigListState<T>) {
		if (this.props.onChange && prevState.sorted !== this.state.sorted) {
			this.props.onChange(
				[...this.state.sorted],
				this.state.sort
			);
		}
	}

	private setSort(c: ListColumn) {
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
		const { value, clickable, className, options, columns } = this.props;
		// const { sort, displayed, columns, header } = this.state;
		const { sort, sorted, header } = this.state;
		return (
			<div className={`big-list ${className || ""}`}>
				{header ? (
					<div className="bl-header">
						{columns.map((c, i) => (
							<div key={`column-${i}`} className={`bl-cell ${c.className || ""}`}>
								{c.sortable ? (
									<button
										className={classnames("bl-column bl-button", {
											"bl-sorted": sort?.column == c,
											"bl-sorted-desc": !!sort?.desc,
										})}
										onClick={() => this.setSort(c)}
									>
										<span className="bl-button-content">
											{typeof c.header == "function"
												? c.header(options || null, this.headerHandler.bind(this))
												: c.header}
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
										{typeof c.header == "function"
											? c.header(options || null, this.headerHandler.bind(this))
											: c.header}
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
								sorted[index] === value,
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
