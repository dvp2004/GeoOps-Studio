# GeoOps Studio Smoke Test Checklist

Use this checklist before tagging the local MVP as frozen.

## Boot

- [ ] Backend starts locally with `python -m uvicorn backend.app.main:app --reload`
- [ ] Frontend starts locally with `npm run dev`
- [ ] Frontend loads without console errors
- [ ] Backend health endpoint responds successfully

## Built-in demo flow

- [ ] App loads with no files selected
- [ ] Empty-state message is visible
- [ ] `Run built-in demo` completes successfully
- [ ] Comparison summary appears
- [ ] Current network map renders
- [ ] Optimised network map renders
- [ ] Baseline assignments table renders
- [ ] Optimised assignments table renders

## Template and sample downloads

- [ ] Demand template downloads
- [ ] Facility template downloads
- [ ] Demand sample downloads
- [ ] Current facilities sample downloads
- [ ] Candidate facilities sample downloads
- [ ] Downloaded templates have the correct columns
- [ ] Downloaded sample files pass validation when uploaded

## Manual workflow

- [ ] Demand CSV upload works
- [ ] Current facilities CSV upload works
- [ ] Candidate facilities CSV upload works
- [ ] `Validate demand + current` works
- [ ] `Validate demand + candidate pool` works
- [ ] `Run current baseline` works
- [ ] `Run current vs optimised comparison` works
- [ ] Result state clears correctly when switching files
- [ ] `Reset workspace` clears files, inputs, results, and messages

## Results and export

- [ ] Baseline weighted cost is shown
- [ ] Optimised weighted cost is shown
- [ ] Improvement percentage is shown
- [ ] Current facility IDs are shown
- [ ] Selected optimised facility IDs are shown
- [ ] JSON export works
- [ ] Assignments CSV export works
- [ ] Facilities CSV export works
- [ ] Exported files contain expected data

## Config and environment

- [ ] App works with default local config
- [ ] Frontend works with `frontend/.env.local`
- [ ] No CORS errors occur in browser console

## Repo sanity

- [ ] No obviously dead placeholder files remain
- [ ] `git status` is clean after intended changes
- [ ] Root README matches the current app behaviour
- [ ] Demo commands in README actually work