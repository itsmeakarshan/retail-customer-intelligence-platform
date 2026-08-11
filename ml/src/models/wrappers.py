"""
Custom Scikit-Learn Estimator Wrappers
"""
import numpy as np
from sklearn.base import BaseEstimator, RegressorMixin

class NonNegativeRegressorWrapper(BaseEstimator, RegressorMixin):
    """
    Wrapper ensuring regression predictions are strictly non-negative.
    Complies with Scikit-Learn check_is_fitted convention.
    """
    def __init__(self, regressor=None):
        self.regressor = regressor
        
    def fit(self, X, y):
        if self.regressor is None:
            raise ValueError("Regressor cannot be None")
        self.regressor_ = self.regressor.fit(X, y)
        self.is_fitted_ = True
        return self
        
    def predict(self, X):
        preds = self.regressor_.predict(X)
        return np.maximum(preds, 0.0)
