import 'dotenv/config';
import { createApp } from './app.js';
import { loadFeeds } from './engine/feeds.js';

const port = Number(process.env.PORT ?? 8787);
const app = createApp();

app.listen(port, () => {
  console.log(`[bluehats] API listening on http://127.0.0.1:${port}`);
  loadFeeds().then((feeds) => {
    if (feeds.loaded) {
      console.log(
        `[bluehats] feeds armed · ${feeds.domainSet.size.toLocaleString()} domains · ${feeds.urlSet.size.toLocaleString()} urls · snapshot ${feeds.db.generatedAt}`,
      );
    } else {
      console.log('[bluehats] feeds not loaded · run "npm run feeds" to arm the offline reputation lists');
    }
  });
});
