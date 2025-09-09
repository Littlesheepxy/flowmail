import { z } from "zod";

export const contactFormSchema = z.object({
	email: z.string().email(),
	name: z.string().min(3),
	message: z.string().min(10),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;
