// Spec §6.2 `maxPropertyStringLength`, copied like src/limits.ts and checked by contract.test.ts.
// A file of its own so the module entry points do not pull core's constants into a shared chunk.
export const MAX_PROPERTY_STRING_LENGTH = 255;
