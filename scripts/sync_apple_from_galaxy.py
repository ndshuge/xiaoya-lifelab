#!/usr/bin/env python3
"""Mirror only tracked Apple source from ndshuge-galaxy. Preview by default."""
import argparse, pathlib, subprocess, json
PREFIX = "little-works/xiaoya-apple/"
def git(repo,*args):
    return subprocess.check_output(["git","-C",str(repo),*args], stderr=subprocess.PIPE)
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--source-repo",required=True,type=pathlib.Path)
    ap.add_argument("--ref",default="origin/main")
    ap.add_argument("--apply",action="store_true")
    args=ap.parse_args()
    src=args.source_repo.resolve(strict=True)
    dest=pathlib.Path(__file__).resolve().parent.parent
    commit=git(src,"rev-parse","--verify",args.ref+"^{commit}").decode().strip()
    names=[b.decode("utf-8") for b in git(src,"ls-tree","-r","-z","--name-only",commit,"--",PREFIX).split(b"\0") if b]
    if len(names)<40: raise RuntimeError("Refusing incomplete source tree")
    # Never overwrite tracked, uncommitted work in the canonical repository.
    changed=git(dest,"status","--porcelain","--untracked-files=no","--",PREFIX).decode().strip()
    if args.apply and changed:
        raise RuntimeError("Unsaved canonical Apple edits; commit or stash them before syncing: "+changed[:300])
    stamps={
        PREFIX+"index.html":"../../version-switcher.js?v=20261102",
        PREFIX+"native-v3/index.html":"../../../version-switcher.js?v=20261102",
    }
    total=0
    for name in names:
        if not name.startswith(PREFIX) or ".." in pathlib.PurePosixPath(name).parts: raise RuntimeError("Unsafe path "+name)
        path=dest.joinpath(*pathlib.PurePosixPath(name).parts)
        if not path.resolve().is_relative_to(dest): raise RuntimeError("Outside target "+name)
        data=git(src,"show",f"{commit}:{name}")
        total+=len(data)
        if name in stamps:
            html=data.decode("utf-8")
            if html.count("</body>")!=1: raise RuntimeError("Cannot attach version switcher to "+name)
            html=html.replace("</body>",'<script src="'+stamps[name]+'"></script>\n</body>')
            data=html.encode("utf-8")
        if args.apply:
            path.parent.mkdir(parents=True,exist_ok=True)
            path.write_bytes(data)
    report={"source_repository":"https://github.com/ndshuge/ndshuge-galaxy","source_commit":commit,"canonical_repository":"https://github.com/ndshuge/xiaoya-lifelab","tree":PREFIX,"tracked_files":len(names),"total_bytes":total,"untracked_files_included":False,"version_switcher_injected":True}
    if args.apply: (dest/"APPLE_SOURCE_PROVENANCE.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print(json.dumps({"applied":args.apply,**report},ensure_ascii=False,indent=2))
if __name__=="__main__":main()
