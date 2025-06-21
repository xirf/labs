import {
    defineConfig,
    presetIcons,
    presetTypography,
    presetWebFonts,
    presetWind4,
    transformerVariantGroup,
} from 'unocss';

export default defineConfig({
    content: {
        pipeline: {
            include: [
                /\.(mdx|md|astro|html|json|vue)($|\?)/,
                "src/content/**/*.{md.mdx}",
                "src/**/*.{yml,yaml}",
                "src/**/*.json",
            ]
        },
    },
    theme: {
        colors: {
            "d-base": "#080a1a",
            "d-on-base": "#f9fafb",
            "l-base": "#fbfaf5",
            "l-on-base": "#222222"
        }
    },
    transformers: [
        transformerVariantGroup(),
    ],
    presets: [
        presetWind4({
            dark: "class",
        }),
        presetTypography(),
        presetWebFonts({
            provider: "google",
            fonts: {
                sans: "Lexend:300,400,500,700",
                mono: "JetBrains Mono:400",
            }
        }),
        presetIcons({
            collections: {
                myna: () => import("@iconify-json/mynaui/icons.json").then((i) => i.default),
                lucide: () => import("@iconify-json/lucide/icons.json").then((i) => i.default),
                solar: () => import("@iconify-json/solar/icons.json").then((i) => i.default),
            },
            extraProperties: {
                'display': 'inline-block',
                'fill': 'currentColor',
            },
        }),
    ],
})