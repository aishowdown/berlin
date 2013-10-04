AI Showdown #2 -- Berlin AI
===========================

Welcome to AI Showdown #2.  This time we're featuring a game called Berlin AI.
Berlin was written by another group of programmers at berlin-ai.com but we are
featuring it here and running our tournament using the game they wrote in
conjunction with their developers.

The rules of the game can be found at the
[documentation page](https://github.com/thirdside/berlin-ai/wiki/Berlin).


The fine folks behind the game have their own servers that run the games for you
on their website.  Eventually, you will need to upload your bot to Heroku where
it can interact with their game server and if you are going to use our example bot
the instructions to do so can be found in
[this Google Doc](https://docs.google.com/document/d/1Ha_2UgC4eRYbEs5TDJoX6pG0Y4UkIrIE_FXEmkO1-PU/edit)

Note, when writing your bot, the only file here you should have to edit
is bot.py.  As always you're welcome to do whatever you'd like, but this
will probably be the easiest way to get playing the game.

----

However, in the interest of quickly iterating on changes, debugging, and tweaking
constant values to optimize performance, we have also included a local copy of the
server so that you can run games between two bots on your own machine.  This can
speed up your development if you'd like to do it, but is by no means necessary.

To run a local game:

1. Start the two bots that you would like to run against each other so that
they are listening on different ports, eg:

            python bot1.py 8882
            python bot2.py 8883

2. Run the game.py script and supply those two ports as (comma separated) line arguments to the script, e.g.

            python game.py 8882,8883

3. This will run the game and generate a json log that you can watch via the visualizer in viz.html or analyze with your own software.
