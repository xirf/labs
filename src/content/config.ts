import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

const content = defineCollection({
    loader: glob({
        pattern: '**/*.mdx',
        base: 'src/content',
    }),
    schema: z.object({
        imageUrl: z.string(),
        title: z.string(),
        description: z.string(),
        github: z.string().optional(),
        date: z.date()
    })
});

export const collections = {
    content,
};