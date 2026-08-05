import { Input } from "@/components/ui/input";

// A free-text input backed by a `<datalist>` of suggestions — the
// "configurable, not hard-coded" pattern several module PRDs specify for
// their type/role/source fields (Team Type, Client Type, Lead Source, ...):
// the picker offers the PRD's starter list, but any custom value is valid.
export function SuggestInput({
  id,
  name,
  suggestions,
  defaultValue,
}: {
  id: string;
  name: string;
  suggestions: readonly string[];
  defaultValue?: string;
}) {
  const listId = `${id}-suggestions`;
  return (
    <>
      <Input id={id} name={name} list={listId} defaultValue={defaultValue} />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}
