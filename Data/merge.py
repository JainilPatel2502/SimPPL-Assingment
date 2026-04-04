import pandas as pd

df1 = pd.read_csv("epstein_submissions_2026_01.csv")
df2 = pd.read_csv("epstein_submissions_2026_02.csv")

df = pd.concat([df1, df2], ignore_index=True)
df["content"] = df["title"].fillna("") + " " + df["selftext"].fillna("")

df["date"] = pd.to_datetime(df["created_utc"], unit="s")
df.to_csv('epstine_submissions_merged.csv')
print("Total rows:", len(df))
