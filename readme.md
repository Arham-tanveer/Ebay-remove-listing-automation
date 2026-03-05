// README.md
# eBay Listing Auto Selector Extension

## Installation Instructions

1. **Load the extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `ebay-auto-selector` folder
   - The extension should now appear in your extensions list

## How to Use

1. **Navigate to eBay listings page:**
   - Go to your eBay Seller Hub active listings page
   - Or use the mock page

2. **Click the extension icon** in Chrome toolbar

3. **Set your filters:**
   - Views: Select operator (<, <=, =, >=, >) and enter value (e.g., < 20)
   - Watchers: Select operator and value (e.g., = 0)
   - Sold Quantity: Select operator and value (e.g., <= 1)
   - Time Left: Select operator and value in days (e.g., < 10)
   - Leave any filter empty to ignore it

4. **Click "Apply Filters & Select"**
   - The extension will automatically check all listings matching your conditions
   - You'll see a confirmation showing how many items were selected

5. **Click "Clear All Selections"** to uncheck all items

## Example Use Cases

**Find slow-moving items:**
- Views < 20
- Watchers = 0
- Sold <= 1
- Days < 10

**Find items about to expire:**
- Days < 2
- Sold = 0

**Find popular but unsold items:**
- Views >= 50
- Watchers >= 3
- Sold = 0

## Features

- ✅ Works on actual eBay listing pages
- ✅ Works on mock/test pages
- ✅ Flexible operators for each filter
- ✅ Optional filters (leave blank to ignore)
- ✅ Clear all selections with one click
- ✅ Visual feedback on selection count
- ✅ Parses various time formats (days, hours, minutes)

## Troubleshooting

If the extension doesn't work:
1. Make sure you're on an eBay listing page or the mock page
2. Check that all filter values are valid numbers
3. Reload the page and try again
4. Check the Chrome console (F12) for any errors