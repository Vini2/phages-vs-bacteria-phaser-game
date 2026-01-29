# 🧬 Phagefall

**Phagefall** is a fast-paced biology-inspired arcade game built with [Phaser](https://phaser.io/). You control a bacteriophage inside a petri dish, infecting and lysing bacteria before they overrun the environment.

> Attach → Inject → Lyse → Replicate. Survive the microbial arms race.

🎮 **Play the game here:**  
👉 https://vini2.github.io/phagefall/

## 🎮 Gameplay

* You control a phage
* Move around the dish
* Attach to bacteria
* Inject DNA
* Lyse them to score points
* Each successful lysis spawns new helper phages
* Bacteria reproduce continuously and accelerate over time
* Win by clearing enough bacteria
* Lose if bacteria overrun the dish

The game is designed to teach the lytic cycle visually, without text-heavy explanations.


## 🧠 Key Mechanics

### 🧫 Bacteria

* Multiply over time
* Reproduce faster as population grows
* Move and drift naturally
* Can overwhelm the dish if ignored

### 🦠 Phages

Player-controlled phage performs primary lysis

Helper phages:

* Mostly swarm and pressure bacteria
* A small number can lyse on their own
* Always secondary to player control

## ⚖️ Difficulty System

Growth rate scales with:

* Time elapsed
* Current bacteria count

Helper phages are capped for performance. Player must actively manage outbreaks.


## 🕹️ Controls

| Action  | Input                    |
| ------- | ------------------------ |
| Move    | WASD / Arrow Keys        |
| Attach  | Click / Tap              |
| Inject  | Automatic while attached |
| Restart | Click after game over    |


## ⚙️ Tech Stack

* Phaser 3
* JavaScript (ES6)
* Canvas rendering
* Procedural graphics
* No external assets
