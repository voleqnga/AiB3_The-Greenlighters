import os
import numpy as np
import pickle
from scipy.sparse import load_npz

_ROOT = os.path.dirname(os.path.abspath(__file__))
_PRE = os.path.join(_ROOT, '..', 'preprocess')
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.metrics import accuracy_score
import xgboost as xgb
import shap
import matplotlib.pyplot as plt
import joblib
import json

X = load_npz(os.path.join(_PRE, 'X_processed_full.npz')).tocsr()
y = np.load(os.path.join(_PRE, 'y_processed_full.npy'))
with open(os.path.join(_PRE, 'feature_names_full.pkl'), 'rb') as f:
    feature_names = pickle.load(f)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# --- BƯỚC 2: HUẤN LUYỆN XGBOOST ---
# tham số ở dưới đã được tune và lược bớt, gốc là
''''
param_grid_xgb = {
    'n_estimators': [300, 350, 400],      # Số lượng cây (càng nhiều càng học kỹ)
    'max_depth': [10, 15],          # Độ sâu của cây (càng sâu càng dễ Overfit)
    'learning_rate': [0.01],    # Tốc độ học
    'subsample': [0.7,0.8, 0.9]               #  dữ liệu mỗi lần để tránh học vẹt
}
'''''
param_grid_xgb = {
    'n_estimators': [300],      # Số lượng cây (càng nhiều càng học kỹ)
    'max_depth': [15],          # Độ sâu của cây (càng sâu càng dễ Overfit)
    'learning_rate': [0.01],    # Tốc độ học
    'subsample': [0.7]               # Chỉ dùng 70% dữ liệu mỗi lần để tránh học vẹt
}

xgb_model = xgb.XGBClassifier(
    random_state=42,
    eval_metric='logloss'
)

# Chạy Grid Search
grid_xgb = GridSearchCV(xgb_model, param_grid_xgb, cv=3, scoring='accuracy', verbose=1)
grid_xgb.fit(X_train, y_train)

# Lấy ra model ngon nhất
xgb_model = grid_xgb.best_estimator_

print(f"\nTham số tốt nhất: {grid_xgb.best_params_}")
print(f"Độ chính xác trên tập Test: {accuracy_score(y_test, xgb_model.predict(X_test)):.2%}")

# --- BƯỚC 3: SHAP TỔNG QUAN (AN TOÀN CHO RAM) ---
print("\n[*] Đang tính toán SHAP...")
# Chỉ lấy đúng 200 dòng để vẽ cho nhanh
X_train_sample = shap.utils.sample(X_train, 200)
X_train_sample_dense = X_train_sample.toarray()

explainer = shap.Explainer(xgb_model)
#shap_values = explainer.shap_values(X_train)
shap_values_sample = explainer(X_train_sample_dense, )
plt.figure(figsize=(10, 8))
shap.summary_plot(shap_values_sample, X_train, feature_names=feature_names, max_display=15, show=False)

plt.title("Phân tích các yếu tố quan trọng nhất (Tuned XGBoost)", fontsize=16)
plt.tight_layout()
plt.show()

# Chuyển X_train từ dạng thưa (sparse) sang dạng đặc (dense/numpy array)
# X_train_dense = X_train.toarray()


def extract_shap_to_json(single_cv_shap, cv_index, feature_names):
    base_value = float(single_cv_shap.base_values)
    final_score = float(base_value + np.sum(single_cv_shap.values))
    impacts = []
    for i in range(len(feature_names)):
        impacts.append({
            "feature": feature_names[i],
            "original_value": float(single_cv_shap.data[i]),
            "shap_impact": float(single_cv_shap.values[i])
        })

    positives = sorted([x for x in impacts if x['shap_impact'] > 0], key=lambda x: x['shap_impact'], reverse=True)[:5]
    negatives = sorted([x for x in impacts if x['shap_impact'] < 0], key=lambda x: x['shap_impact'])[:5]

    result_dict = {
        "cv_id": f"candidate_{cv_index}",
        "base_score": round(base_value, 2),
        "ai_final_score": round(final_score, 2),
        "top_positive_factors": [{"feature": p['feature'], "impact": round(p['shap_impact'], 2)} for p in positives],
        "top_negative_factors": [{"feature": n['feature'], "impact": round(n['shap_impact'], 2)} for n in negatives]
    }
    return json.dumps(result_dict, indent=4, ensure_ascii=False)


print("\n[*] Đang xử lý bóc tách cho 1 CV...")
cv_index = 0
# Lấy đúng 1 CV ra ép kiểu (Siêu tốc)
cv_test_dense = X_train[cv_index:cv_index + 1].toarray()
shap_values_single = explainer(cv_test_dense,)

# In JSON
print("\n--- KẾT QUẢ JSON ---")
print(extract_shap_to_json(shap_values_single[0], cv_index, feature_names))

# Vẽ Waterfall
fig, ax = plt.subplots(figsize=(10, 6))
# Gán title cho Axes (ax) chứ không gán cho plt nữa để tránh trùng
ax.set_title("Giải thích chi tiết điểm số cho Hồ sơ ứng viên số 0", fontsize=16)

# 2. Lấy dữ liệu SHAP cho riêng CV đầu tiên (Index 0)
cv_index = 0
shap_values_single = explainer(X_train_sample_dense[cv_index:cv_index+1])

# 3. Ép waterfall plot vẽ VÀO CÁI AXES ĐÓ
shap.plots.waterfall(shap_values_single[0], max_display=10, show=False)

# plt.tight_layout() # <-- Có thể không cần dòng này nữa
plt.show()

# ==========================================
# BƯỚC 5: LƯU MODEL
# ==========================================
joblib.dump(xgb_model, os.path.join(_ROOT, 'xgb_model.pkl'))
with open(os.path.join(_PRE, 'feature_names_fair.pkl'), 'wb') as f:
    pickle.dump(feature_names, f)


print("--- ĐÃ LƯU MODEL THÀNH CÔNG! ---")
print("Bạn sẽ thấy 2 file .pkl xuất hiện trong thư mục.")
# In điểm trên chính dữ liệu nó đã học (Tập Train)
print(f"Điểm trên tập Train (Học vẹt): {accuracy_score(y_train, xgb_model.predict(X_train)):.2%}")

# In điểm trên dữ liệu nó chưa thấy bao giờ (Tập Test)
print(f"Điểm trên tập Test (Thực lực): {accuracy_score(y_test, xgb_model.predict(X_test)):.2%}")