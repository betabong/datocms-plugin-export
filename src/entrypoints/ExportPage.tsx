import { RenderPageCtx } from 'datocms-plugin-sdk';
import { Canvas, SelectField, Button } from 'datocms-react-ui';
import { useMemo, useState } from 'react';
import ReactJson from 'react-json-view-ts';
import { buildClient } from '@datocms/cma-client-browser';
import s from './styles.module.scss';

type Props = {
	ctx: RenderPageCtx;
};

export default function ExportPage({ ctx }: Props) {
	const [selectedItemType, setSelectedItemType] = useState<string | undefined>(undefined);
	const [entries, setEntries] = useState<any[]>([]);
	const [entriesCount, setEntriesCount] = useState<number>(0);
	const [loading, setLoading] = useState<false | number>(false);
	const [fields, setFields] = useState<{ label: string; value: string }[]>([]);
	const [selectedFields, setSelectedFields] = useState<{ label: string; value: string }[]>([]);
	if (!ctx.currentUserAccessToken) {
		return <p>Token is missing</p>;
	}
	const client = useMemo(() => {
		return buildClient({
			apiToken: ctx.currentUserAccessToken!,
			environment: ctx.environment,
		});
	}, [ctx.currentUserAccessToken]);

	async function selectItemType(itemType: string | undefined) {
		setSelectedItemType(itemType);
		if (!itemType) return;
		ctx.loadItemTypeFields(itemType).then((rawFields) => {
			const fields = [
				...rawFields.map((field) => ({
					label: field.attributes.label,
					value: field.attributes.api_key,
				})),
				{ label: 'Updated at', value: 'updated_at' },
				{ label: 'Created at', value: 'created_at' },
			].sort((a, b) => a.label.localeCompare(b.label));

			setFields(fields);
			setSelectedFields([...fields]);
		});
		client.items.rawList({ filter: { type: itemType }, page: { limit: 0 } }).then((items) => {
			setEntriesCount(items.meta.total_count);
		});
		client.items.list({ filter: { type: itemType }, page: { limit: 10 }, nested: 'true' }).then((items) => {
			setEntries(items);
		});
	}

	async function download() {
		const pages = client.items.listPagedIterator({ filter: { type: selectedItemType } });

		const articles = [];
		for await (const article of pages) {
			articles.push(article);
			setLoading(articles.length);
		}
		setLoading(false);

		var dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filterResult(articles), null, 2));
		var dlAnchorElem = document.createElement('a');
		document.body.appendChild(dlAnchorElem);
		dlAnchorElem.setAttribute('href', dataStr);
		dlAnchorElem.setAttribute('download', getItemTypeName(selectedItemType!) + '.json');
		dlAnchorElem.click();
		document.body.removeChild(dlAnchorElem);
	}

	function filterResult(entries: any[]) {
		return entries.map((entry) => {
			const result: Partial<typeof entry> = {};
			const apiKeys = ['id', ...selectedFields.map((field) => field.value)];
			Object.keys(entry)
				.filter((key) => apiKeys.includes(key))
				.forEach((key) => {
					result[key] = entry[key];
				});
			return result;
		});
	}

	function getItemTypeName(itemType: string) {
		return Object.values(ctx.itemTypes).find((value) => value?.id === itemType)?.attributes.name;
	}

	return (
		<Canvas ctx={ctx}>
			<div className={s.PageLayout}>
				<ul className={s.ItemBar}>
					{Object.entries(ctx.itemTypes)
						.filter(([key, value]) => !value?.attributes.modular_block)
						.map(([key, value]) => (
							<li key={key}>
								<button aria-selected={value?.id === selectedItemType ? 'true' : 'false'} onClick={() => selectItemType(value?.id)}>
									{value?.attributes.name}
								</button>
							</li>
						))}
				</ul>
				<div className={s.Main}>
					{selectedItemType && (
						<>
							<SelectField
								name="multipleOption"
								id="multipleOption"
								label="Fields"
								hint="Which fields to export"
								value={selectedFields}
								selectInputProps={{
									isMulti: true,
									options: fields,
								}}
								onChange={(newValue) => setSelectedFields([...newValue])}
							/>
						</>
					)}
					{entries.length > 0 && (
						<>
							<p>
								{loading === false ? (
									<Button onClick={download}>Download {entriesCount} Entries</Button>
								) : (
									<Button disabled={true}>
										Downloading {loading} of {entriesCount} Entries
									</Button>
								)}
							</p>

							<h3>Preview</h3>
							<ReactJson
								src={filterResult(entries)}
								enableClipboard={false}
								onEdit={false}
								onAdd={false}
								onDelete={false}
								displayDataTypes={false}
								displayObjectSize={false}
								collapsed={2}
							/>
						</>
					)}
				</div>
			</div>
		</Canvas>
	);
}
