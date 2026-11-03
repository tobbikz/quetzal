'use client';

export type CustomFieldInputDef = {
  fieldId: number;
  required: boolean;
  field: {
    name: string;
    type: 'text' | 'number' | 'select' | 'date';
    options: string[];
  };
};

/** Form inputs for custom fields (create modal / new issue). Names: cf_<id>. */
export function CustomFieldInputs({
  fields,
  values,
}: {
  fields: CustomFieldInputDef[];
  values?: Record<number, string>;
}) {
  if (!fields.length) return null;
  return (
    <>
      {fields.map((item) => {
        const name = `cf_${item.fieldId}`;
        const value = values?.[item.fieldId] ?? '';
        const label = item.required ? `${item.field.name} *` : item.field.name;
        if (item.field.type === 'select') {
          return (
            <label key={item.fieldId} className="field">
              <span>{label}</span>
              <select name={name} defaultValue={value} required={item.required}>
                <option value="">{item.required ? 'Select…' : 'None'}</option>
                {item.field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        if (item.field.type === 'number') {
          return (
            <label key={item.fieldId} className="field">
              <span>{label}</span>
              <input type="number" name={name} defaultValue={value} required={item.required} />
            </label>
          );
        }
        if (item.field.type === 'date') {
          return (
            <label key={item.fieldId} className="field">
              <span>{label}</span>
              <input type="date" name={name} defaultValue={value} required={item.required} />
            </label>
          );
        }
        return (
          <label key={item.fieldId} className="field wide">
            <span>{label}</span>
            <input type="text" name={name} defaultValue={value} required={item.required} />
          </label>
        );
      })}
    </>
  );
}
