# 🌿 GreenVerse - Sustainable Shopping Assistant
**One‑Click Sustainable Shopping on Amazon.in**


<p align="center">
  <img src="./extension/sampleImages/animation.gif" alt="GreenVerse in action" width="600"/>
</p>

## 🌱 Why GreenVerse?
- **Fragmented eco‑data: no single source for CO₂, water & waste metrics**
- **Vague “eco” labels; manual comparison is time‑consuming**
- **Multiple shipments → duplicated packaging & emissions**


## Features
### 🔍 GreenMind  
Instant 0–100 Sustainability Score for every product 

---

### 🔄 Swap — One‑Click Greener Alternative  
![Swap Button](./extension/sampleImages/sampleImage1.png)  
Click the green “Swap” button to instantly replace a product with a higher‑scoring alternative.  

---

### ♻️ EcoTwin — Side‑by‑Side Lifecycle Comparison  
![EcoTwin Comparison](./extension/sampleImages/sampleImage2.png)  
Expand the EcoTwin card to see CO₂, water, and waste metrics for your current product vs. the suggested greener option.  

---

### 📦 GreenCart AI  
Bundle same‑region items for fewer shipments  

### 🏆 Gamification  
![Swap Button](./extension/sampleImages/sampleImage3.png)  
CO₂ saved dashboard + achievement badges  




## How It Works

1. Scrapes product & cart data from Amazon.in
2. Looks up LCA averages & custom overrides
3. Computes scores, swap & bundling suggestions
4.  Displays in‑page popup with instant actions



## System Architecture
![Arch](Arch.png)


## 🧪 Testing 
```bash
git clone https://github.com/<you>/greenverse-extension.git
```
```bash
cd Greenverse-extension/
```
```bash
node scripts/generateAlternatives.mjs
```
```bash
npm run build
```




## 🤝 Contributing
Issues and pull requests are welcome.

## 📄 License
This project is licensed under the MIT License.


