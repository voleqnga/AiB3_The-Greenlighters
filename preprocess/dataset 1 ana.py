import os
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
import pickle
from scipy.sparse import hstack, save_npz
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import OneHotEncoder, StandardScaler

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

df1 = pd.read_csv(os.path.join(_SCRIPT_DIR, 'dataset1_.csv'))
'''
print('df 1 shape:', df1.shape)
print(df1.head())

print(df1['Best Match'].value_counts())

print("Số lượng sample trùng:",df1.duplicated().sum())

print("Số lượng missing value:")
print(df1.isnull().sum())

print("Kiểm tra text len:")
df1['textlen']= df1['Resume'].astype(str).apply(len)
print(df1['textlen'].describe())
df1.drop('textlen', axis=1, inplace=True)

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# 1. Load dữ liệu
df1 = pd.read_csv(os.path.join(_SCRIPT_DIR, 'dataset1_.csv'))

# --- BƯỚC 1: CHUẨN BỊ DỮ LIỆU ---
# Tạo cột nhóm tuổi (Age Group) để gom nhóm (VD: 20-30 tuổi, 30-40 tuổi...)
# bins=[20, 30, 40, 50, 100]: Các mốc cắt tuổi
df1['Age_Group'] = pd.cut(df1['Age'],
                          bins=[20, 30, 40, 50, 100],
                          labels=['20s', '30s', '40s', '50s+'])

# --- BƯỚC 2: TÍNH TOÁN TỶ LỆ ĐẬU ---
# Dùng groupby để tính trung bình cột 'Best Match' (1 là đậu, 0 là rớt)
# Kết quả 0.61 nghĩa là 61% đậu

print("--- KẾT QUẢ PHÂN TÍCH THIÊN KIẾN (BIAS) ---")

# a. Theo Giới tính
bias_gender = df1.groupby('Gender')['Best Match'].mean()
print("\n1. Tỷ lệ Đậu theo Giới tính:\n", bias_gender)

# b. Theo Sắc tộc
bias_race = df1.groupby('Race')['Best Match'].mean()
print("\n2. Tỷ lệ Đậu theo Sắc tộc:\n", bias_race)

# c. Theo Tuổi
bias_age = df1.groupby('Age_Group', observed=False)['Best Match'].mean()
print("\n3. Tỷ lệ Đậu theo Nhóm tuổi:\n", bias_age)

# --- BƯỚC 3: VẼ BIỂU ĐỒ TRỰC QUAN HÓA (QUAN TRỌNG) ---
# Tạo khung vẽ gồm 3 biểu đồ con nằm ngang
fig, ax = plt.subplots(1, 3, figsize=(18, 5))

# Biểu đồ 1: Giới tính
sns.barplot(x=bias_gender.index, y=bias_gender.values, ax=ax[0], palette='pastel')
ax[0].set_title('Tỷ lệ Đậu theo Giới tính (Gender Bias)')
ax[0].set_ylabel('Tỷ lệ Đậu')
ax[0].set_ylim(0, 1) # Cố định trục Y từ 0 đến 100%
ax[0].axhline(0.5, color='red', linestyle='--', alpha=0.5) # Đường trung bình 50%

# Biểu đồ 2: Sắc tộc
sns.barplot(x=bias_race.index, y=bias_race.values, ax=ax[1], palette='pastel')
ax[1].set_title('Tỷ lệ Đậu theo Sắc tộc')
ax[1].set_ylabel('')
ax[1].tick_params(axis='x', rotation=45) # Xoay chữ nghiêng cho dễ đọc
ax[1].set_ylim(0, 1)
ax[1].axhline(0.5, color='red', linestyle='--', alpha=0.5)

# Biểu đồ 3: Tuổi
sns.barplot(x=bias_age.index, y=bias_age.values, ax=ax[2], palette='pastel')
ax[2].set_title('Tỷ lệ Đậu theo Nhóm tuổi')
ax[2].set_ylabel('')
ax[2].set_ylim(0, 1)
ax[2].axhline(0.5, color='red', linestyle='--', alpha=0.5)

plt.tight_layout()
plt.show()
'''''''''''
### Xử lý resume + JD bằng chung 1 TF-IDF vocabulary
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity as cos_sim_fn
import joblib

all_text = pd.concat([
    df1['Resume'].astype(str).str.lower().fillna(''),
    df1['Job Description'].astype(str).str.lower().fillna('')
])
tfidf = TfidfVectorizer(stop_words='english', max_features=500)
tfidf.fit(all_text)

X_cv  = tfidf.transform(df1['Resume'].astype(str).str.lower().fillna(''))
X_jd  = tfidf.transform(df1['Job Description'].astype(str).str.lower().fillna(''))

cos_scores = np.array([
    cos_sim_fn(X_cv[i], X_jd[i])[0, 0] for i in range(len(df1))
]).reshape(-1, 1)

vocab = list(tfidf.get_feature_names_out())
names_cv  = ['cv_' + w for w in vocab]
names_jd  = ['jd_' + w for w in vocab]
names_sim = ['CV_JD_Similarity']

### Xử lý gender, race, job roles
from sklearn.preprocessing import OneHotEncoder
categorical_cols = ['Gender', 'Race', 'Job Roles']
encoder = OneHotEncoder()
X_cat = encoder.fit_transform(df1[categorical_cols])
names_cat = list(encoder.get_feature_names_out(categorical_cols))

##Xử lý age
scaler = StandardScaler()
X_age = scaler.fit_transform(df1[['Age']])
names_age = ['Age_Scaled']

##Gộp cột lưu file: [cv_tfidf, jd_tfidf, cosine_sim, demographics]
from scipy.sparse import csr_matrix
cos_sparse = csr_matrix(cos_scores)
X_final = hstack([X_cv, X_jd, cos_sparse, X_cat, X_age])
y = df1['Best Match']

feature_names = names_cv + names_jd + names_sim + names_cat + names_age

save_npz(os.path.join(_SCRIPT_DIR, 'X_processed_full.npz'), X_final)
np.save(os.path.join(_SCRIPT_DIR, 'y_processed_full.npy'), y)
with open(os.path.join(_SCRIPT_DIR, 'feature_names_full.pkl'), 'wb') as f:
    pickle.dump(feature_names, f)

joblib.dump(tfidf, os.path.join(_SCRIPT_DIR, 'tfidf_vectorizer.pkl'))
print(f'[Done] Features: {len(feature_names)} (CV:{len(names_cv)} + JD:{len(names_jd)} + Sim:1 + Demo:{len(names_cat)+1})')
print(f'[Done] Saved (under preprocess/): X_processed_full.npz, y_processed_full.npy, feature_names_full.pkl, tfidf_vectorizer.pkl')