/** MySQL DECIMAL comes back as a string — normalise to number | null. */
export const decimalTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null || value === undefined ? null : Number(value)),
};
