# Spending Sankey

*Drag-drop your bank CSVs, see where your money goes.*

## The problem

You have accounts at 3 banks and 2 credit cards. You want to understand your spending patterns and build a budget. Every bank exports CSVs differently — different column names, date formats, amount conventions. Categorizing "AMZN Mktp US*2K7..." as "Shopping" is tedious. No tool makes it easy to go from raw bank exports to a clear picture of money flow.

## What this does

A web app. Drag-and-drop CSVs from any bank. AI auto-detects the format (column mapping, date parsing, amount conventions) and categorizes each transaction. Renders an interactive Sankey diagram: income sources on the left, spending categories on the right, flow width shows relative amounts. Helps you build a budget from what you actually spend.

## Who it's for

Anyone who wants to understand their spending without signing up for Mint/Monarch or connecting their bank accounts to a third party.

## Sample scenario

You download CSVs from Chase, your credit union, and your Amex. You drag all three into the app. It auto-detects that Chase uses "Amount" while the credit union uses "Debit/Credit" columns. Categorizes transactions. You see a Sankey diagram showing $6,200/month income flowing into Housing (38%), Food (22%), Transport (12%), and everything else. You spot that "Subscriptions" is $340/month and start canceling.

## What it takes to build

~2-4 weeks. React frontend, Claude API for CSV format detection and categorization, D3.js for the Sankey visualization. Single-page app, no backend needed if processing happens client-side.

## Ongoing cost

$0 if using client-side processing. If using Claude API for categorization: variable, usage-based.

## Status

Repo initialized. Ready to build.
