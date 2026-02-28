## CredCheck! 
A full-stack risk assessment tool that predicts credit card default using machine learning, and is still VERY much a work-in-progress. I built this to explore the end-to-end process of bringing a model from a training environment into something we can actually try out, it's been a lot of fun :)

**To track progress:** [usecredcheck.vercel.app](https://usecredcheck.vercel.app)

**The Setup**:
* Tech stack: FastAPI (Python), JS and D3.js.
* ML: Evaluated several models (Logistic Regression, KNN, SVM, Dummy), ultimately selecting a Random Forest classifier that reached 81.07% accuracy.
* Feature Engineering: Developed custom metrics like credit utilization and payment ratios to improve model performance.
