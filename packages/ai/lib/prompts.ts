/**
 * List product names prompt
 *
 * @param {string} topic - The topic to generate product names for.
 * @return {string} The prompt.
 */
export const promptListProductNames = (topic: string): string => {
	return `List me five funny product names that could be used for ${topic}`;
};
