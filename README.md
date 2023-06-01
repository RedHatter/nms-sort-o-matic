# No Man's Sky Sort-o-matic
Uses save file manipulation to manage the inventory in No Man's Sky. Using save file manipulation unfortunately means that live in-game sorting is not possible as any changes require the save to be reloaded in order to take effect.

Feel free to [open an issue](https://github.com/RedHatter/nms-sort-o-matic/issues/new) to request a feature or report a bugs.

## Usage

```
Description
  Use save file manipulation to manage the inventory in No Man's Sky.
  
Usage
  $ nms-sort-o-matic <command> [options]
  
Available Commands
  sort      Sort all inventories
  print     Display the items in all inventories
  find      Search for <search-term> in all inventories
  update    Download the configuration files
  decode    Decript and decode <save-file> into human readable json
  encode    Encode <save-file> into the format expected by the game
  
For more info, run any command with the `--help` flag
  $ nms-sort-o-matic sort --help
  $ nms-sort-o-matic print --help

Options
  -v, --version    Displays current version
  -h, --help       Displays this message   
```