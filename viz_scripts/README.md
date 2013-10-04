Berlin SVG Viewer
=================

This viewer is used to view games on [Berlin](http://www.berlin-ai.com).

How to use
----------

This repository includes a test `index.html` that can load a game from Berlin via an input text box.

To obtain the game, the test `index.html` send a JSONP `GET request` at `http://berlin-ai.com/games/id.json` where `id` is the id of the game.

Do not try load more than one game per page load because it is not currently supported.
