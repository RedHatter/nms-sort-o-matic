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

## Setting up auto sort
There are a number of ways to set things up so that `nms-sort-o-matic` runs automatically before the game starts. The following are a few example setups.

### Prerequisite
* Location of the No Man's Sky directory.  
  e.g. `D:\Steam\steamapps\common\No Man's Sky\Binaries`
* Location of your save file  
  e.g. `C:\Users\John Doe\AppData\Roaming\HelloGames\NMS\st_76561198278198416\save.hg`
* [Download latest release](https://github.com/RedHatter/nms-sort-o-matic/releases/latest/download/nms-sort-o-matic.exe) and place `nms-sort-o-matic.exe` in the No Man's Sky Binaries directory. 

Note: The following methods use scripts with `pause` in them in order to allowing viewing the ouput before the game starts. If you would prefer for the the game to start immediately simply remove that line.
### bat file

Create a `No Man's Sky.bat` file wherever you would like with the following content. Replace the path to the Binaries directory and save file appropriately.
```
@echo off
"D:\Steam\steamapps\common\No Man's Sky\Binaries\nms-sort-o-matic" "C:\Users\John Doe\AppData\Roaming\HelloGames\NMS\st_76561198278198416\save.hg"
pause
start "No Man's Sky" "D:\Steam\steamapps\common\No Man's Sky\Binaries\NMS"
```

### Steam
1. Create a `nms-sort-o-matic.bat` file in the No Man's Sky Binaries directory with the following content. Replace the save file location appropriately.
```
@echo off
nms-sort-o-matic "C:\Users\John Doe\AppData\Roaming\HelloGames\NMS\st_76561198278198416\save.hg"
pause
```
2. Open steam and navigate to "Steam -> No Man's Sky -> Properties -> General"
3. Set the launch options to `nms-sort-o-matic.bat && %command%`

*Note: If anyone could tell me why simply running the `nms-sort-o-matic.exe` direclty from the launch options doesn't work I would be appreciative.*

### GOG
1. Create a `NMS.bat` file in the No Man's Sky Binaries directory with the following content. Replace the save file location appropriately.
```
@echo off
nms-sort-o-matic "C:\Users\John Doe\AppData\Roaming\HelloGames\NMS\DefaultUser\save.hg"
start "No Man's Sky" NMS
```
2. Navigate to "GOG Galaxy -> No Man's Sky -> Manage installation -> Configure -> Features"
3. Scroll to the bottom and click "Add another excutable / arguments".
    * Select `NMS.bat` as the excutable.
    * Set the label to "No Man's Sky".
    * Check "Default exectable"
    * Click "OK"