import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>URLShot</h1>
          <p>Fast API for capturing website screenshots.</p>
        </section>
        <div className={styles.actions}>
          <a
            className={styles.button}
            href="https://rapidapi.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on RapidAPI
          </a>
        </div>
        <pre className={styles.code}>{`curl -X POST "https://urlshot.dev/api/screenshot" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://example.com","format":"png"}' \\
  --output screenshot.png`}</pre>
      </main>
    </div>
  );
}
