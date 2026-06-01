# Changing Local GitHub to Personal

How to push a repo to a **personal** GitHub account from a machine whose terminal / Windows Credential Manager / Copilot is signed in with a **work** GitHub account — without touching any global settings.

Strategy: per-repo git identity + a dedicated SSH key exposed under a custom SSH host alias.

---

## 1. Set a repo-local git identity

From the repo root:

```powershell
git config --local user.name  "Shimon Sarkar"
git config --local user.email "shimonsarkar3432@gmail.com"
```

`--local` writes only to `.git/config`. Global identity (work) stays as-is.

## 2. Generate a dedicated SSH key for personal GitHub

```powershell
# Ensure the .ssh folder exists (silent if already there)
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.ssh" | Out-Null

ssh-keygen -t ed25519 -C "your-personal@email.com" -f "$env:USERPROFILE\.ssh\id_ed25519_personal"
```

Press Enter twice if you don't want a passphrase.

> **Gotcha:** if the `.ssh` directory doesn't exist, `ssh-keygen` fails with
> `Saving key "...id_ed25519_personal" failed: No such file or directory`.
> Create the folder first as shown above.

## 3. Add the public key to your personal GitHub account

```powershell
Get-Content "$env:USERPROFILE\.ssh\id_ed25519_personal.pub" | Set-Clipboard
```

On github.com (signed in as your **personal** account):
Settings → SSH and GPG keys → **New SSH key** → paste → Add SSH key.

> **Gotcha:** if you skip this step, `ssh -T` returns
> `git@github.com: Permission denied (publickey).` Authentication can't
> succeed until the public key is registered on the account you're targeting.

## 4. Define an SSH host alias

Open or create `C:\Users\<you>\.ssh\config`:

```powershell
notepad "$env:USERPROFILE\.ssh\config"
```

Add:

```sshconfig
Host github-personal
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_personal
  IdentitiesOnly yes
```

The alias `github-personal` resolves to `github.com` but forces SSH to use *only* the personal key. Other repos using the normal `github.com` host are unaffected.

## 5. Point the repo's remote at the alias

```powershell
git remote -v
# origin  git@github.com:YourUser/Repo.git  (fetch)
# origin  git@github.com:YourUser/Repo.git  (push)

git remote set-url origin git@github-personal:YourPersonalUsername/YourRepo.git

git remote -v
# origin  git@github-personal:YourPersonalUsername/YourRepo.git  (fetch)
# origin  git@github-personal:YourPersonalUsername/YourRepo.git  (push)
```

> **Gotcha:** if you push while the remote still says `git@github.com:...`,
> SSH ignores the alias and tries the default key (your work key, or none),
> producing `Permission denied (publickey)`. The remote URL **must** start
> with `git@github-personal:` for the alias to apply.

## 6. Verify authentication

```powershell
ssh -T git@github-personal
# Hi YourPersonalUsername! You've successfully authenticated, but GitHub does not provide shell access.
```

If it instead says `Permission denied`, run with `-vT` and confirm:
- It reads `C:\Users\<you>\.ssh\config`
- It applies `Host github-personal`
- It offers `id_ed25519_personal`

And confirm the fingerprint matches what's listed on personal GitHub:

```powershell
ssh-keygen -lf "$env:USERPROFILE\.ssh\id_ed25519_personal.pub"
```

## 7. Push

```powershell
git branch -M main          # if your branch isn't already 'main'
git add .
git commit -m "Initial commit"
git push -u origin main
```

---

## What was *not* changed

- `git config --global` (work identity stays the default everywhere else)
- Windows Credential Manager entries for github.com
- GitHub CLI (`gh`) auth
- VS Code GitHub Copilot account
- Any other repo on the machine

All personal-account configuration lives in two isolated places:
- `.git/config` inside this repo (identity + remote URL)
- `~/.ssh/config` + `~/.ssh/id_ed25519_personal*` (key used only when host alias is invoked)
