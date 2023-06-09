import { Telegraf, session } from "telegraf"
import config from "config"
import { message } from "telegraf/filters"
import { code } from 'telegraf/format'
import { ogg } from './ogg.js'
import { openai } from "./openai.js"
import express from 'express';

const app = express();

app.get('/', (req, res) => {
    res.send("Hello, world!")
})

const port = 3000
app.listen(port, () => {
    console.log(`Server running at https://localhost:${port}`)
})

const INITIAL_SESSION = {
    messages: [],
}

const bot = new Telegraf(config.get('TELEGRAM_TOKEN'))


bot.use(session())

bot.command('new', async (ctx) => {
    ctx.session = INITIAL_SESSION
    await ctx.reply("Waiting fot text or voice message")
})

bot.command('start', async (ctx) => {
    ctx.session = INITIAL_SESSION
    await ctx.reply("Waiting fot text or voice message")
})

bot.on(message('voice'), async (ctx) => {
    if (!ctx.session) {
        ctx.session = INITIAL_SESSION
    }

    try {
        await ctx.reply(code('Massage resived. Wait for response...'))

        const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
        const userId = String(ctx.message.from.id)
        const oggPath = await ogg.create(link.href, userId)
        const mp3Path = await ogg.toMp3(oggPath, userId)

        const text = await openai.transcription(mp3Path)
        await ctx.reply(code(`Your request: ${text}`))


        ctx.session.messages.push({ role: openai.roles.USER, content: text })

        const response = await openai.chat(ctx.session.messages)

        ctx.session.messages.push({
            role: openai.roles.ASSISTANT,
            content: response.content,
        })

        await ctx.reply(response.content)
    } catch (e) {
        console.log(`Error while voice message`, e.message)
    }
})

bot.on(message('text'), async (ctx) => {
    if (!ctx.session) {
        ctx.session = INITIAL_SESSION
    }
    try {
        await ctx.reply(code('Massage resived. Wait for response...'))

        ctx.session.messages.push({ role: openai.roles.USER, content: ctx.message.text })

        const response = await openai.chat(ctx.session.messages)

        ctx.session.messages.push({
            role: openai.roles.ASSISTANT,
            content: response.content,
        })

        await ctx.reply(response.content)
    } catch (e) {
        console.log(`Error while text message`, e.message)
    }
})


bot.launch()

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))