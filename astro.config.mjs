// @ts-check
import {defineConfig} from 'astro/config';
import Unocss from 'unocss/astro';

import vue from '@astrojs/vue';

import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
    site: "https://labs.andka.my.id",
    integrations: [vue(), Unocss({
        injectReset: true
    }), mdx()]
});