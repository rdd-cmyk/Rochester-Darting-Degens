-- Only the isolated development stack enables new writes during local setup.
UPDATE rdd_private.game_modes_control SET enabled=true WHERE id=true;
