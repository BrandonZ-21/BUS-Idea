# Tally feedback form (Google Form content)

Draft, 2026-10-13. This is what goes into the Google Form behind the "Give feedback" link. Edit the wording so it sounds like you before it goes live. About two minutes to fill in; only questions 2 and 6 are required.

## Form settings

- Collect email addresses: **Do not collect**
- Limit to 1 response: **Off** (it would force a Google sign-in)
- Restrict to Brandeis users: **Off**, or owners outside Brandeis can't open it
- Show progress bar: Off. Single page, no sections.
- Confirmation message: "Thank you. This really helps. — Brandon"

## Title

Tally feedback / Tally 意见反馈

## Description

Thanks for trying Tally. I'm Brandon, a Brandeis student, and this is my class project. It is not affiliated with Square. This takes about two minutes, and honest answers, including "it wasn't useful", help the most.

Please don't type sales figures or customer details here. Tally sends this form nothing from your data; I only see what you write below.

谢谢你试用 Tally。我是 Brandeis 的学生 Brandon，这是我的课程项目，和 Square 公司没有关系。填写大约需要两分钟，请直接说真实想法，“没什么用”也很有帮助。请不要在这里填写销售数字或顾客信息。

## Questions

| # | Question | Type | Options | Required |
|---|---|---|---|---|
| 1 | What kind of business do you run? / 你经营的是哪种生意？ | Multiple choice | Cafe or coffee shop / 咖啡店 · Bakery / 面包店 · Restaurant / 餐厅 · Food truck or stand / 餐车或摊位 · Other | No |
| 2 | How did you put your sales into Tally? / 你是怎么把销售数据放进 Tally 的？ | Multiple choice | Connected Square / 连接了 Square · Uploaded a file / 上传了文件 · Only looked at the sample data / 只看了示例数据 · I couldn't get it to work / 没能成功 | Yes |
| 3 | Which parts were useful to you? / 哪些部分对你有用？ | Checkboxes | This week vs. last week / 这周对比上周 · Busy-times heatmap / 忙闲时段热力图 · Top items / 热销商品 · Suggestions / 建议 · Day notes and holidays / 每日备注和节假日 · Weather / 天气 · Returning customers / 回头客 · None of it / 都没用 | No |
| 4 | Was there a number you didn't believe, or that didn't match Square? What was it? / 有没有你不相信的数字，或者和 Square 对不上的地方？ | Paragraph | | No |
| 5 | Have you tried the AI assistant in your Square Dashboard? / 你用过 Square 后台里的 AI 助手吗？ | Multiple choice | Yes, I still use it / 用过，现在还在用 · I tried it and stopped / 试过，后来不用了 · No / 没用过 · I didn't know it existed / 不知道有这个功能 | No |
| 6 | Would you use Tally weekly? / 你会每周用 Tally 吗？ | Linear scale 1 to 5 | 1 = Definitely not / 肯定不会 · 5 = Definitely / 肯定会 | Yes |
| 7 | What is the one thing that would make it more useful? / 哪一件事能让它对你更有用？ | Paragraph | | No |
| 8 | If you're open to a 10-minute follow-up, how can I reach you? (optional) / 如果愿意花十分钟聊一聊，我可以怎么联系你？（可不填） | Short answer | | No |

A ninth question was added on 2026-10-13: "Anything else? What didn't you like, what was confusing, or any other feedback." (Paragraph, optional). In the live form it currently sits second; drag it to the end.

## Live form (published 2026-10-13)

- Responder link: https://docs.google.com/forms/d/e/1FAIpQLSfJ7K3j0KxON1BXdOTdUVvFK7P2YcJRZLzdSkbrXIN2Z50ZPg/viewform
- Edit link: https://docs.google.com/forms/d/1S9I5lvWfu6E8dnfF9AHZqAKYeL-JmkyPjsumu-I_55M/edit
- Responders: anyone with the link. Email collection off.

## After creating it

1. Press **Send**, choose the link tab, tick **Shorten URL**, and copy the `forms.gle/...` link.
2. Paste it into `public/js/config.js` as `feedbackFormUrl`.
3. Open `card.html` to check the QR code scans to the form, then print.

Have a fluent writer check the Chinese lines before sending the form to a Chinese-speaking owner.
