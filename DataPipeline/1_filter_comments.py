import zstandard as zstd
import json
import io
import csv

input_file = "./reddit/comments/RC_2026-02.zst"
output_file = "epstein_comments_2026_02.csv"

keywords = [
    "epstein",
    "jeffrey epstein",
    "epstein files",
    "epstein list",
    "epstein documents",
    "epstein client list",
    "epstein island",
    "epstein flight logs",
    "epstein scandal",
    "epstein investigation",
    "epstein victims",
    "epstein court documents",
    "epstein case",
    "epstein trial",
    "epstein testimony",
    "little saint james",
    "little st james",
    "saint james island",
    "st james island",
    "virgin islands",
    "us virgin islands",
    "sex trafficking ring",
    "sex trafficking scandal",
    "underage trafficking",
    "elite pedophile ring",
    "pedophile ring",
    "sex scandal",
    "child trafficking",
    "child exploitation",
    "jeffrey epstein case",
    "epstein associates",
    "epstein network",
    "epstein lawsuit",
    "epstein files release",
    "ghislaine maxwell",
    "maxwell trial",
    "maxwell documents",
    "prince andrew epstein",
    "clinton epstein",
    "trump epstein",
    "epstein black book",
    "epstein flight list"
]

header_written = False

with open(output_file, "w", newline="", encoding="utf-8") as csvfile:

    writer = None

    with open(input_file, "rb") as fh:

        dctx = zstd.ZstdDecompressor()
        reader = dctx.stream_reader(fh)
        text_stream = io.TextIOWrapper(reader, encoding="utf-8")

        count = 0

        for line in text_stream:
            try:
                post = json.loads(line)

                text = (post.get("title", "") + " " + post.get("selftext", "")).lower()

                if any(k in text for k in keywords):

                    # initialize CSV writer dynamically
                    if not header_written:
                        fields = list(post.keys())
                        writer = csv.DictWriter(csvfile, fieldnames=fields)
                        writer.writeheader()
                        header_written = True

                    writer.writerow(post)

                    count += 1

                    if count % 1000 == 0:
                        print("Saved:", count)

            except Exception:
                continue

print("Filtering complete")