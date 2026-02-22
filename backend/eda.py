import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import os
from sklearn.model_selection import train_test_split
from features import NUMERIC_FEATS, TARGET, add_engineered_features

def perform_eda(df):
    """
    Performs EDA on the credit card dataset, focusing on the target distribution, feature correlations.
    """
    print("Overview:")
    print(df.info())
    
    # 1. Target Distribution (with percentages)
    plt.figure(figsize=(6, 4))
    ax = sns.countplot(x=TARGET, data=df, hue=TARGET, palette='flare')
    plt.title('Distribution of Target (0: No Default, 1: Default)')
    
    for p in ax.patches:
        # Annotate each patch/bar with the count
        ax.annotate(f'{int(p.get_height())}', 
                    (p.get_x() + p.get_width() / 2., p.get_height()), 
                    ha = 'center', va = 'center', 
                    xytext = (0, 9), 
                    textcoords = 'offset points',
                    fontsize=10, color='#4d0026')

    plt.title('Total Default vs. Non-Default Counts', pad=20)
    sns.despine()
    plt.savefig('plots/target_distribution.png')

    # 2. Correlation Heatmap
    # Summary view using engineered bill/pay features to avoid clutter
    summary_cols = [TARGET, 'util_mean', 'pay_avg', 'bill_avg', 'AGE', 'LIMIT_BAL']
    labels = {
        'LIMIT_BAL': 'Credit Limit',
        'AGE': 'Age',
        'bill_avg': 'Avg Bill',
        'pay_avg': 'Avg Payment',
        'util_mean': 'Avg Utilization',
        TARGET: 'Default'  
    }
    df_plot = train_df[summary_cols].rename(columns=labels)    
    plt.figure(figsize=(10, 8))
    corr = df_plot.corr(numeric_only=True)
    sns.heatmap(corr, annot=True, cmap='flare', center=0, square=True)
    plt.title('Summary Feature Correlations')
    # plt.tight_layout()
    plt.subplots_adjust(bottom=0.25)
    plt.xticks(rotation=45, ha='right')
    plt.yticks(rotation=0)
    plt.savefig('frontend/plots/summary_heatmap.png')

    # 3. Categorical Relationships (Education,Marriage vs Target), using ordered categories
    cat_features = ['EDUCATION', 'MARRIAGE']
    mappings = {
        'MARRIAGE': {0: "Unknown", 1: "Married", 2: "Single", 3: "Other"},
        'EDUCATION': {0: "Unknown", 1: "Grad", 2: "Uni", 3: "HighSchool", 4: "Other", 5: "Unknown", 6: "Unknown"}
    }
    orders = {
        'MARRIAGE': ["Married", "Single", "Other", "Unknown"],
        'EDUCATION': ["HighSchool", "Uni", "Grad", "Other", "Unknown"]
    }
    for feat in cat_features:
        if feat in df.columns:
            plt.figure(figsize=(8, 5))
            # Stacked bar chart
            plot_df = df.copy()
            plot_df['Display_Label'] = plot_df[feat].map(mappings[feat])
            plot_df['Display_Label'] = pd.Categorical(
                plot_df['Display_Label'], 
                categories=orders[feat], 
                ordered=True
            )
    
   
            prop_df = plot_df.groupby('Display_Label')[TARGET].value_counts(normalize=True).unstack()

            prop_df.plot(kind='bar', stacked=True, color=['#2ecc71', '#e74c3c'])
            plt.title(f'Default Proportion by {feat}')
            plt.ylabel('Proportion')
            plt.xlabel(feat)
            plt.legend(title='Default', labels=['No', 'Yes'])
            plt.xticks(rotation=0)
            plt.xlabel(f"{feat.capitalize()} Status")
            plt.savefig(f'plots/{feat.lower()}_vs_target.png')

    # 4. Boxplots to detect Outliers (LIMIT_BAL)
    plt.figure(figsize=(8, 6))
    sns.boxplot(x=TARGET, y='LIMIT_BAL', data=df, palette='rocket')
    plt.title('Credit Limit by Target Class')
    plt.savefig('plots/limit_bal_boxplot.png')


if __name__ == "__main__":
    data_path = 'backend/data/UCI_Credit_Card.csv'
    df = pd.read_csv(data_path)
    df = add_engineered_features(df)
        
    train_df, _ = train_test_split(df, test_size=0.3, random_state=123)
    
    if not os.path.exists('plots'):
        os.makedirs('plots')
        
    perform_eda(train_df)
    print(df['EDUCATION'].value_counts())