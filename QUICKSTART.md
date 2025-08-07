# Quick Start Guide

## 🚀 Get Running in 2 Minutes

### 1. Start the Application
```bash
docker compose up
```

### 2. Open Your Browser
Navigate to: **http://localhost:5173**

### 3. Login
- Use any email/password (it's mock authentication)
- Example: `demo@boe.local` / `password`

## 🎯 Try These Features

### Create Your First Report

1. **Drag a Field**
   - Look at the left panel "Fields"
   - Click and drag "Fund Name" from Fund Information

2. **Drop on Canvas**
   - Drop it on the empty canvas area
   - A table section will automatically be created

3. **Add More Fields**
   - Drag "Total Assets" and drop on the same table
   - Drag "1 Month Return" to add performance data
   - Watch the table populate with mock data!

4. **Resize and Move**
   - Drag the table header to move it around
   - Drag corners to resize

### What's Working
- ✅ **Drag-and-drop** from field tree to canvas
- ✅ **Automatic table creation** with data
- ✅ **Currency/percentage formatting**
- ✅ **Grid-based layout** with resize/move
- ✅ **Mock fund data** (100+ funds)

### What's Not Yet Working
- ❌ Properties panel (display only)
- ❌ Charts (coming soon)
- ❌ Export functionality
- ❌ Field removal
- ❌ Real database connection

## 🛠️ Development Tips

### View Logs
```bash
docker compose logs -f frontend
```

### Restart After Code Changes
```bash
docker compose restart frontend
```

### Run Test Script
```bash
./test-frontend.sh
```

### Access Database Admin
- URL: http://localhost:5050
- Email: `admin@boe.local`
- Password: `admin`

## 📁 Key Files to Know

- `frontend/src/pages/ReportBuilder/index.tsx` - Main report builder
- `frontend/src/components/ReportBuilder/FieldSelector.tsx` - Draggable fields
- `frontend/src/components/ReportBuilder/ReportCanvas.tsx` - Drop area
- `frontend/src/services/mockData/fundData.ts` - Mock data generator
- `frontend/src/store/slices/reportBuilderSlice.ts` - State management

## 🐛 Common Issues

### Container Won't Start
```bash
docker compose down
docker compose build --no-cache
docker compose up
```

### Changes Not Showing
- Check if hot reload is working in logs
- Try hard refresh in browser (Ctrl+Shift+R)
- Restart the frontend container

### Can't Drag Fields
- Make sure you're clicking on the field text
- Check browser console for errors
- Try refreshing the page

## 📚 Next Steps

1. **Explore the Code**
   - Check `PLAN.md` for architecture details
   - Review `TODO.md` for what's being built
   - See `CHANGELOG.md` for recent updates

2. **Try Building Something**
   - Add a new field to `FieldSelector.tsx`
   - Modify table formatting in `ReportCanvas.tsx`
   - Create a new section type

3. **Report Issues**
   - Check `BUGS.md` for known issues
   - Test edge cases
   - Document any problems found

---

**Need Help?** Check the README.md for detailed documentation.