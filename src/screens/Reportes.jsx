import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Reportes = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate('/reportes/nomina', { replace: true });
  }, [navigate]);
  
  return null;
};

export default Reportes;
