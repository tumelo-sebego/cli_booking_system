---
type: concept
title: Database Schema
---
# Database Schema

The system uses MongoDB with Mongoose ODM.

## Collections

### 1. `Student`
Stores student information and session state.
- `surname` (String, required)
- `studentNumber` (String, required, unique)
- `isLoggedIn` (Boolean, default: false)

### 2. `Booking`
Stores PC booking details.
- `studentNumber` (String, required)
- `day` (String, required)
- `pcNumber` (Number, required)

### 3. `Admin`
Stores admin information and session state.
- `adminName` (String, required)
- `adminNumber` (String, required, unique)
- `isLoggedIn` (Boolean, default: false)
