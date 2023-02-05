Pathway:

/cache/{pageId}

Triggers the job to fetch the page from Notion:
- Retrieve recordMap from Notion by pageId
- Load the recordMap from KV, and compare first block > type:page > version numbers, return if same.
- Loop over images
	- Look up each image in images API by ID+Version
	- If no match,
		- Store into images API with key of ID+Version
		- Rewrite signed image URL with stored image URL
- Store recordMap into KV by pageId

/{pageId}

Loads the recordMap from KV and returns it:
- Load the recordMap from KV by pageId
	- If not found, cache it using same function as /cache endpoint
- Returns the recordMap